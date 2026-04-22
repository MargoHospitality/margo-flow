export type ArrivalSourceKey = 'booking' | 'airbnb' | 'expedia' | 'direct' | 'other';
export type ArrivalTransportStatus = 'none' | 'requested' | 'confirmed';
export type ArrivalCheckinStatus = 'not_yet' | 'completed';

export type ArrivalProperty = {
  id: string;
  name: string;
};

export type ArrivalSourceOption = {
  key: ArrivalSourceKey;
  label: string;
};

export type ArrivalTransportSummary = {
  id: string;
  status: string;
  date: string;
  time: string;
  pax: number;
  guestComment: string | null;
  offerName: string | null;
  offerType: string | null;
} | null;

export type ArrivalCheckinGuest = {
  firstName?: string | null;
  lastName?: string | null;
  nationality?: string | null;
  passportNumber?: string | null;
};

export type ArrivalCheckinSummary = {
  completedAt: string | null;
  syncedToCloudbeds: boolean;
  cloudbedsSyncAt: string | null;
  cloudbedsSyncError: string | null;
  transportStatus: string | null;
  transportMethod: string | null;
  transportDetails: string | null;
  arrivalTime: string | null;
  guests: ArrivalCheckinGuest[];
  restaurationPreferences: string | null;
  beddingPreferences: string | null;
  beddingDetails: string | null;
  otherRequests: string | null;
} | null;

export type ArrivalRecord = {
  reservationId: string;
  riadId: string | null;
  propertyId: string;
  propertyName: string;
  guestName: string;
  guestFirstName: string | null;
  guestLastName: string;
  guestCountryCode: string | null;
  checkInDate: string;
  checkOutDate: string | null;
  reservationStatus: string;
  sourceKey: ArrivalSourceKey;
  sourceLabel: string;
  sourceRaw: string | null;
  transportStatus: ArrivalTransportStatus;
  checkinStatus: ArrivalCheckinStatus;
  arrivalTime: string | null;
  transport: ArrivalTransportSummary;
  checkin: ArrivalCheckinSummary;
};

export function getTransportBadgeClass(status: ArrivalTransportStatus) {
  if (status === 'confirmed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (status === 'requested') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export function getTransportLabel(status: ArrivalTransportStatus) {
  if (status === 'confirmed') return 'Confirmed';
  if (status === 'requested') return 'Requested';
  return 'No transport';
}

export function getCheckinBadgeClass(status: ArrivalCheckinStatus) {
  if (status === 'completed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export function getCheckinLabel(status: ArrivalCheckinStatus) {
  return status === 'completed' ? 'Completed' : 'Not yet';
}
