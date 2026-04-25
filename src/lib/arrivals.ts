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
  isComplimentary: boolean;
  guestComment: string | null;
  offerName: string | null;
  offerType: string | null;
  payloadDetails: Record<string, unknown> | null;
} | null;

export type ArrivalCheckinGuest = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
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
  guestPhone: string | null;
  checkInDate: string;
  checkOutDate: string | null;
  reservationStatus: string;
  guestCount: number;
  roomNames: string[];
  sourceKey: ArrivalSourceKey;
  sourceLabel: string;
  sourceRaw: string | null;
  transportStatus: ArrivalTransportStatus;
  checkinStatus: ArrivalCheckinStatus;
  arrivalTime: string | null;
  transport: ArrivalTransportSummary;
  checkin: ArrivalCheckinSummary;
};

export function getSourceBadgeClass(sourceKey: ArrivalSourceKey) {
  if (sourceKey === 'booking') {
    return 'border-[#003580] bg-[#003580] text-white';
  }

  if (sourceKey === 'expedia') {
    return 'border-[#191E3B] bg-[#191E3B] text-[#FFCB4D]';
  }

  if (sourceKey === 'airbnb') {
    return 'border-[#FF385C] bg-[#FF385C] text-white';
  }

  if (sourceKey === 'direct') {
    return 'border-slate-200 bg-slate-100 text-slate-950';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export function getTransportBadgeClass(status: ArrivalTransportStatus) {
  if (status === 'confirmed') {
    return 'border-[#a8ddda] bg-[#effafa] text-[#006b69]';
  }

  if (status === 'requested') {
    return 'border-[#a7d6dc] bg-[#f1fafb] text-[#0b6b78]';
  }

  return 'border-[#d7ebec] bg-[#f3fbfb] text-[#005663]';
}

export function getTransportLabel(status: ArrivalTransportStatus) {
  if (status === 'confirmed') return 'Confirmed';
  if (status === 'requested') return 'Requested';
  return 'No transport';
}

export function getCheckinBadgeClass(status: ArrivalCheckinStatus) {
  if (status === 'completed') {
    return 'border-status-confirmed bg-status-confirmed text-status-confirmed-foreground';
  }

  return 'border-[#d7ebec] bg-[#f3fbfb] text-[#005663]';
}

export function getCheckinLabel(status: ArrivalCheckinStatus) {
  return status === 'completed' ? 'Completed' : 'Not yet';
}
