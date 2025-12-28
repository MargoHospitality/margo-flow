import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { Check, X, Edit2, User, Calendar, Clock, Users, Car, Loader2, Hash, Plane, CreditCard, MessageSquare, Mail, Phone, Ban, Gift } from 'lucide-react';
import { toast } from 'sonner';

interface TransportRequest {
  id: string;
  reservation_id: string;
  riad_id: string;
  transport_date: string;
  transport_time: string;
  pax: number;
  computed_price: number;
  payment_mode: string;
  payload_details: Record<string, string>;
  status: string;
  rejection_reason: string | null;
  guest_comment?: string | null;
  created_at: string;
  is_free_transfer?: boolean;
  riad: { name: string; manager_email?: string | null; manager_whatsapp?: string | null };
  reservation: {
    guest_first_name: string | null;
    guest_last_name: string;
    check_in_date: string;
  };
  transport_offer: {
    name: string;
    name_fr: string | null;
    type: string;
  };
}

interface RequestCardProps {
  request: TransportRequest;
  isSuperAdmin: boolean;
  onUpdate: () => void;
  compact?: boolean;
}

export function RequestCard({ request, isSuperAdmin, onUpdate, compact = false }: RequestCardProps) {
  const { t, language } = useLanguage();
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [editedTime, setEditedTime] = useState(request.transport_time);
  const [editedFlightNumber, setEditedFlightNumber] = useState(request.payload_details?.flight_number || '');
  const [isLoading, setIsLoading] = useState(false);

  const statusColors = {
    pending: 'bg-amber-light/20 text-amber border-amber/30',
    confirmed: 'bg-teal/10 text-teal border-teal/30',
    rejected: 'bg-destructive/10 text-destructive border-destructive/30',
    cancelled: 'bg-muted text-muted-foreground border-border',
    canceled_due_to_reservation: 'bg-muted text-muted-foreground border-border',
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('transport_requests')
        .update({ status: 'confirmed' })
        .eq('id', request.id);

      if (error) throw error;

      // Send confirmation to guest (WhatsApp primary, email fallback)
      const guestEmail = request.payload_details?.guest_email;
      const guestPhone = request.payload_details?.guest_whatsapp;
      
      if (guestEmail) {
        try {
          // Get riad details for manager contact info
          const { data: riadData } = await supabase
            .from('riads')
            .select('manager_email, manager_whatsapp')
            .eq('name', request.riad.name)
            .single();

          await supabase.functions.invoke('notify-client', {
            body: {
              transportRequestId: request.id,
              language: language,
              guestName: `${request.reservation.guest_first_name || ''} ${request.reservation.guest_last_name}`.trim(),
              guestEmail: guestEmail,
              guestPhone: guestPhone || undefined,
              propertyName: request.riad.name,
              reservationId: request.reservation_id,
              transportType: language === 'fr' && request.transport_offer.name_fr 
                ? request.transport_offer.name_fr 
                : request.transport_offer.name,
              transportDate: format(parseISO(request.transport_date), 'PPP'),
              transportTime: request.transport_time,
              payloadDetails: request.payload_details,
              guestComment: request.guest_comment,
              paymentMode: request.payment_mode,
              price: Number(request.computed_price),
              managerEmail: riadData?.manager_email,
              managerWhatsapp: riadData?.manager_whatsapp,
              isFreeTransfer: request.is_free_transfer,
            },
          });
        } catch (notificationError) {
          console.error('Error sending client confirmation:', notificationError);
        }
      }

      // Add internal note to Cloudbeds (non-blocking)
      try {
        const noteResult = await supabase.functions.invoke('cloudbeds-add-note', {
          body: {
            transport_request_id: request.id,
            reservation_id: request.reservation_id,
            riad_id: request.riad_id,
            riad_name: request.riad.name, // legacy fallback
            guest_name: `${request.reservation.guest_first_name || ''} ${request.reservation.guest_last_name}`.trim(),
            transport_offer_name: request.transport_offer.name,
            transport_date: format(parseISO(request.transport_date), 'dd/MM/yyyy'),
            transport_time: request.transport_time,
            payload_details: request.payload_details,
            payment_mode: request.payment_mode,
            guest_comment: request.guest_comment,
            price: Number(request.computed_price),
            is_free_transfer: request.is_free_transfer,
          },
        });

        const d = noteResult.data as any;

        if (d?.success && d?.note_created) {
          console.log('Cloudbeds note added successfully', { reservation_id: d.reservation_id, property_id: d.property_id });
        } else if (d?.skipped_reason) {
          console.log('Cloudbeds note skipped:', d.skipped_reason, { reservation_id: d.reservation_id, property_id: d.property_id });
          if (isSuperAdmin) {
            toast.message('Cloudbeds note skipped', {
              description: `${d.skipped_reason} (reservation ${d.reservation_id ?? request.reservation_id})`,
            });
          }
        } else if (d?.error) {
          console.error('Cloudbeds note error:', d.error, d);
          toast.error('Cloudbeds note failed', {
            description: `${d.cloudbeds_status_code ? `HTTP ${d.cloudbeds_status_code} – ` : ''}${(d.cloudbeds_message || d.error || '').toString().slice(0, 120)}`,
          });
        }
      } catch (noteError) {
        console.error('Error adding Cloudbeds note:', noteError);
        toast.error('Cloudbeds note failed');
      }

      toast.success(t('confirm_transport'));
      onUpdate();
    } catch (error) {
      console.error('Error confirming request:', error);
      toast.error(t('error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error(t('rejection_reason_placeholder'));
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('transport_requests')
        .update({ 
          status: 'rejected',
          rejection_reason: rejectionReason.trim()
        })
        .eq('id', request.id);

      if (error) throw error;
      toast.success(t('reject_transport'));
      setIsRejectDialogOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error(t('error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error(t('cancel_reason_placeholder'));
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('transport_requests')
        .update({ 
          status: 'cancelled',
          cancellation_reason: cancelReason.trim(),
          cancelled_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (error) throw error;
      toast.success(t('transport_cancelled'));
      setIsCancelDialogOpen(false);
      setCancelReason('');
      onUpdate();
    } catch (error) {
      console.error('Error cancelling request:', error);
      toast.error(t('error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async () => {
    setIsLoading(true);
    try {
      const updatedPayload = {
        ...request.payload_details,
        flight_number: editedFlightNumber,
      };

      const { error } = await supabase
        .from('transport_requests')
        .update({ 
          transport_time: editedTime,
          payload_details: updatedPayload
        })
        .eq('id', request.id);

      if (error) throw error;
      toast.success(t('save'));
      setIsEditDialogOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating request:', error);
      toast.error(t('error'));
    } finally {
      setIsLoading(false);
    }
  };

  const offerName = language === 'fr' && request.transport_offer.name_fr 
    ? request.transport_offer.name_fr 
    : request.transport_offer.name;

  const flightTrainNumber = request.payload_details?.flight_number || request.payload_details?.train_number;

  // Compact list view
  if (compact) {
    return (
      <>
        <div 
          onClick={() => setIsDetailDialogOpen(true)}
          className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground truncate">
                {request.reservation.guest_first_name} {request.reservation.guest_last_name}
              </span>
              <Badge className={`${statusColors[request.status as keyof typeof statusColors]} border text-xs`}>
                {t(`status_${request.status}` as keyof typeof t)}
              </Badge>
              {request.is_free_transfer && (
                <Badge className="bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30 border text-xs">
                  <Gift className="h-3 w-3 mr-1" />
                  {t('free_transfer_badge')}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseISO(request.transport_date), 'dd MMM')}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {request.transport_time}
              </span>
              <span className="flex items-center gap-1">
                <Car className="h-3 w-3" />
                {offerName}
              </span>
              <span className="truncate">{request.riad.name}</span>
            </div>
          </div>
          {request.status === 'pending' && (
            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
              <Button 
                variant="default" 
                size="sm"
                onClick={handleConfirm}
                disabled={isLoading}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsRejectDialogOpen(true)}
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{t('transport_info')}</span>
                <Badge className={`${statusColors[request.status as keyof typeof statusColors]} border`}>
                  {t(`status_${request.status}` as keyof typeof t)}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <RequestDetails request={request} offerName={offerName} flightTrainNumber={flightTrainNumber} t={t} />
            {request.status === 'pending' && (
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRejectDialogOpen(true)} disabled={isLoading}>
                  <X className="h-4 w-4 mr-1" />
                  {t('reject')}
                </Button>
                <Button onClick={handleConfirm} disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin" /> : <><Check className="h-4 w-4 mr-1" />{t('confirm')}</>}
                </Button>
              </DialogFooter>
            )}
            {request.status === 'confirmed' && (
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCancelDialogOpen(true)} disabled={isLoading}>
                  <Ban className="h-4 w-4 mr-1" />
                  {t('cancel_transport')}
                </Button>
                {isSuperAdmin && (
                  <Button variant="ghost" onClick={() => setIsEditDialogOpen(true)}>
                    <Edit2 className="h-4 w-4 mr-1" />
                    {t('edit_transport')}
                  </Button>
                )}
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('reject_transport')}</DialogTitle>
              <DialogDescription>
                {t('rejection_reason_placeholder')}
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t('rejection_reason_placeholder')}
              className="min-h-[100px]"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : t('reject')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Dialog */}
        <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('cancel_transport')}</DialogTitle>
              <DialogDescription>
                {t('cancel_transport_confirm')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>{t('cancel_reason_label')}</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t('cancel_reason_placeholder')}
                className="min-h-[100px]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)}>
                {t('back')}
              </Button>
              <Button variant="destructive" onClick={handleCancel} disabled={isLoading || !cancelReason.trim()}>
                {isLoading ? <Loader2 className="animate-spin" /> : t('cancel_transport')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Full card view
  return (
    <>
      <Card className="card-elevated card-hover">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                <Hash className="h-3 w-3" />
                {request.riad.name} ({request.reservation_id})
              </p>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {request.reservation.guest_first_name} {request.reservation.guest_last_name}
              </CardTitle>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge className={`${statusColors[request.status as keyof typeof statusColors]} border`}>
                {t(`status_${request.status}` as keyof typeof t)}
              </Badge>
              {request.is_free_transfer && (
                <Badge className="bg-status-confirmed/10 text-status-confirmed border-status-confirmed/30 border text-xs">
                  <Gift className="h-3 w-3 mr-1" />
                  {t('free_transfer_badge')}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Transport Critical Info - Highlighted */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">{offerName}</span>
              </div>
              <div className="flex items-center gap-2 text-lg font-semibold text-primary">
                <Clock className="h-5 w-5" />
                {request.transport_time}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{format(parseISO(request.transport_date), 'PP')}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{request.pax} pax</span>
              </div>
              {flightTrainNumber && (
                <div className="flex items-center gap-1 font-medium">
                  <Plane className="h-4 w-4 text-muted-foreground" />
                  <span>{flightTrainNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Info */}
          <div className={`flex justify-between items-center p-3 rounded-lg ${request.is_free_transfer ? 'bg-status-confirmed/10 border border-status-confirmed/20' : 'bg-secondary/50'}`}>
            <div className="flex items-center gap-2 text-sm">
              {request.is_free_transfer ? (
                <Gift className="h-4 w-4 text-status-confirmed" />
              ) : (
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={request.is_free_transfer ? 'text-status-confirmed font-medium' : 'text-muted-foreground'}>
                {request.is_free_transfer 
                  ? t('payment_complimentary')
                  : (request.payment_mode === 'at_riad' ? t('payment_at_riad') : t('payment_to_driver'))
                }
              </span>
            </div>
            <span className={`text-xl font-display font-bold ${request.is_free_transfer ? 'text-status-confirmed' : 'text-primary'}`}>
              {Number(request.computed_price).toFixed(0)} MAD
            </span>
          </div>

          {/* Guest Comment */}
          {request.guest_comment && (
            <div className="p-3 rounded-lg bg-accent/30 text-sm">
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <span className="text-muted-foreground text-xs">{t('guest_comment_label')}:</span>
                  <p className="text-foreground mt-0.5">{request.guest_comment}</p>
                </div>
              </div>
            </div>
          )}

          {/* Guest Contact Info - Separated */}
          {(request.payload_details?.guest_email || request.payload_details?.guest_whatsapp) && (
            <div className="p-3 rounded-lg border border-border/50 text-sm space-y-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t('guest_info')}</span>
              {request.payload_details?.guest_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <a href={`mailto:${request.payload_details.guest_email}`} className="text-primary hover:underline">
                    {request.payload_details.guest_email}
                  </a>
                </div>
              )}
              {request.payload_details?.guest_whatsapp && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <a 
                    href={`https://wa.me/${request.payload_details.guest_whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {request.payload_details.guest_whatsapp}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Rejection reason */}
          {request.status === 'rejected' && request.rejection_reason && (
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm">
              <p className="font-medium text-destructive">{t('rejection_reason')}:</p>
              <p className="text-muted-foreground">{request.rejection_reason}</p>
            </div>
          )}

          {/* Actions */}
          {request.status === 'pending' && (
            <div className="flex gap-2 pt-2">
              <Button 
                variant="default" 
                size="sm" 
                className="flex-1"
                onClick={handleConfirm}
                disabled={isLoading}
              >
                <Check className="h-4 w-4 mr-1" />
                {t('confirm')}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => setIsRejectDialogOpen(true)}
                disabled={isLoading}
              >
                <X className="h-4 w-4 mr-1" />
                {t('reject')}
              </Button>
            </div>
          )}

          {request.status === 'confirmed' && (
            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => setIsCancelDialogOpen(true)}
                disabled={isLoading}
              >
                <Ban className="h-4 w-4 mr-1" />
                {t('cancel_transport')}
              </Button>
              {isSuperAdmin && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setIsEditDialogOpen(true)}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  {t('edit_transport')}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reject_transport')}</DialogTitle>
            <DialogDescription>
              {t('rejection_reason_placeholder')}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder={t('rejection_reason_placeholder')}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : t('reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('edit_transport')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('transport_time')}</Label>
              <Input
                type="time"
                value={editedTime}
                onChange={(e) => setEditedTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('flight_number')}</Label>
              <Input
                type="text"
                value={editedFlightNumber}
                onChange={(e) => setEditedFlightNumber(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleEdit} disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancel_transport')}</DialogTitle>
            <DialogDescription>
              {t('cancel_transport_confirm')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t('cancel_reason_label')}</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t('cancel_reason_placeholder')}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)}>
              {t('back')}
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isLoading || !cancelReason.trim()}>
              {isLoading ? <Loader2 className="animate-spin" /> : t('cancel_transport')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Separate component for request details in dialog
function RequestDetails({ 
  request, 
  offerName, 
  flightTrainNumber, 
  t 
}: { 
  request: TransportRequest; 
  offerName: string; 
  flightTrainNumber?: string;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-4">
      {/* Free Transfer Badge */}
      {request.is_free_transfer && (
        <div className="p-3 rounded-lg bg-status-confirmed/10 border border-status-confirmed/20 flex items-center gap-2">
          <Gift className="h-5 w-5 text-status-confirmed" />
          <span className="font-medium text-status-confirmed">{t('free_transfer_badge')}</span>
        </div>
      )}
      
      {/* Transport Info Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t('transport_info')}</h4>
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('select_transport_type')}</span>
            <span className="font-medium">{offerName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('transport_date')}</span>
            <span className="font-medium">{format(parseISO(request.transport_date), 'PP')}</span>
          </div>
          <div className="flex items-center justify-between text-lg">
            <span className="text-muted-foreground font-medium">{t('transport_time')}</span>
            <span className="font-bold text-primary">{request.transport_time}</span>
          </div>
          {/* Display ALL dynamic transport fields from payload_details */}
          {Object.entries(request.payload_details || {})
            .filter(([key]) => !['guest_email', 'guest_whatsapp'].includes(key))
            .map(([key, value]) => value ? (
              <div key={key} className="flex items-center justify-between">
                <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="font-medium">{value}</span>
              </div>
            ) : null)}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('passengers')}</span>
            <span className="font-medium">{request.pax}</span>
          </div>
          <div className={`flex items-center justify-between pt-2 border-t border-border ${request.is_free_transfer ? 'text-status-confirmed' : ''}`}>
            <span className={request.is_free_transfer ? 'text-status-confirmed font-medium' : 'text-muted-foreground'}>
              {request.is_free_transfer 
                ? t('payment_complimentary')
                : (request.payment_mode === 'at_riad' ? t('payment_at_riad') : t('payment_to_driver'))
              }
            </span>
            <span className={`text-xl font-bold ${request.is_free_transfer ? 'text-status-confirmed' : 'text-primary'}`}>{Number(request.computed_price).toFixed(0)} MAD</span>
          </div>
        </div>
      </div>

      {/* Guest Comment */}
      {request.guest_comment && (
        <div className="p-3 rounded-lg bg-accent/30 text-sm">
          <span className="text-muted-foreground text-xs">{t('guest_comment_label')}:</span>
          <p className="text-foreground mt-0.5">{request.guest_comment}</p>
        </div>
      )}

      {/* Guest Info Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{t('guest_info')}</h4>
        <div className="p-4 rounded-xl border border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Guest</span>
            <span className="font-medium">{request.reservation.guest_first_name} {request.reservation.guest_last_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('reservation_ref')}</span>
            <span className="font-medium">{request.riad.name} ({request.reservation_id})</span>
          </div>
          {request.payload_details?.guest_email && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('email')}</span>
              <a href={`mailto:${request.payload_details.guest_email}`} className="text-primary hover:underline">
                {request.payload_details.guest_email}
              </a>
            </div>
          )}
          {request.payload_details?.guest_whatsapp && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">WhatsApp</span>
              <a 
                href={`https://wa.me/${request.payload_details.guest_whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {request.payload_details.guest_whatsapp}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
