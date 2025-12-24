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
import { Check, X, Edit2, User, Calendar, Clock, Users, Car, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TransportRequest {
  id: string;
  reservation_id: string;
  transport_date: string;
  transport_time: string;
  pax: number;
  computed_price: number;
  payment_mode: string;
  payload_details: Record<string, string>;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  riad: { name: string };
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
}

export function RequestCard({ request, isSuperAdmin, onUpdate }: RequestCardProps) {
  const { t, language } = useLanguage();
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [editedTime, setEditedTime] = useState(request.transport_time);
  const [editedFlightNumber, setEditedFlightNumber] = useState(request.payload_details?.flight_number || '');
  const [isLoading, setIsLoading] = useState(false);

  const statusColors = {
    pending: 'bg-amber-light/20 text-amber border-amber/30',
    confirmed: 'bg-teal/10 text-teal border-teal/30',
    rejected: 'bg-destructive/10 text-destructive border-destructive/30',
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

  return (
    <>
      <Card className="card-elevated card-hover">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {request.reservation.guest_first_name} {request.reservation.guest_last_name}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{request.riad.name}</p>
            </div>
            <Badge className={`${statusColors[request.status as keyof typeof statusColors]} border`}>
              {t(`status_${request.status}` as keyof typeof t)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Transport info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span>{offerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{request.pax} {t('passengers')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(parseISO(request.transport_date), 'PP')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{request.transport_time}</span>
            </div>
          </div>

          {/* Payload details */}
          {Object.keys(request.payload_details || {}).length > 0 && (
            <div className="p-3 rounded-lg bg-secondary/50 text-sm space-y-1">
              {Object.entries(request.payload_details).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Price */}
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="text-sm text-muted-foreground">
              {request.payment_mode === 'at_riad' ? t('payment_at_riad') : t('payment_to_driver')}
            </span>
            <span className="text-xl font-display font-bold text-primary">
              €{Number(request.computed_price).toFixed(2)}
            </span>
          </div>

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
                variant="teal" 
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

          {request.status === 'confirmed' && isSuperAdmin && (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => setIsEditDialogOpen(true)}
            >
              <Edit2 className="h-4 w-4 mr-1" />
              {t('edit_transport')}
            </Button>
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
    </>
  );
}
