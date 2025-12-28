export type Language = 'en' | 'fr';

export const translations = {
  en: {
    // Common
    app_name: 'MargoFlow',
    loading: 'Loading...',
    error: 'An error occurred',
    submit: 'Submit',
    cancel: 'Cancel',
    confirm: 'Confirm',
    reject: 'Reject',
    save: 'Save',
    back: 'Back',
    next: 'Next',
    
    // Landing page intro
    intro_line_1: 'Margo Flow helps us arrange your arrival smoothly.',
    intro_line_2: 'Your property is a MargoFlow partner and uses this platform to manage and organize arrival transfers for its guests, ensuring a smooth and hassle-free experience.',
    intro_line_3: 'Please enter the information below, and we will take care of the rest.',
    
    // Footer
    footer_copyright: '© 2025 – Created with Love 💙 by',
    footer_margo: 'Margo Hospitality',
    
    // Admin
    admin_users: 'User Management',
    admin_find_user: 'Find user by email',
    admin_search: 'Search',
    admin_user_not_found: 'User not found',
    admin_assign_role: 'Assign Role',
    admin_assign_riads: 'Assign Properties',
    admin_save_changes: 'Save Changes',
    admin_role_pending: 'Pending',
    admin_role_manager: 'Manager',
    admin_role_super_admin: 'Super Admin',
    admin_no_access: 'You do not have access to this area.',
    admin_pending_notice: 'Your account is pending approval. Please contact an administrator.',
    
    // Guest flow
    welcome_title: 'Arrival Transport',
    welcome_subtitle: 'Book your comfortable transfer to the property',
    select_riad: 'Please select your property',
    reservation_lookup: 'Request your transfer',
    riad_name_label: 'Property Name',
    riad_name_placeholder: 'Start typing to search...',
    no_riads_found: 'No properties found',
    reservation_id_label: 'Reservation Number',
    reservation_id_placeholder: 'Enter your booking confirmation ID',
    check_in_date_label: 'Check-in Date',
    check_in_date_placeholder: 'Select your check-in date',
    check_in_date_required: 'Please select your check-in date',
    last_name_label: 'Last Name',
    last_name_placeholder: 'Enter your last name',
    find_reservation: 'Find Reservation',
    reservation_not_found: 'Reservation not found. Please check your details.',
    reservation_invalid: 'This reservation is no longer valid.',
    too_many_requests: 'Too many attempts. Please wait {seconds} seconds.',
    verification_required: 'Verification required. Please complete the security check.',
    verify_human: 'Security Verification',
    complete_captcha: 'Please complete the verification above.',
    captcha_required: 'Please complete the verification to continue.',
    existing_request: 'A transport request already exists for this reservation.',
    rate_limited: 'Too many attempts. Please wait a moment.',
    check_in_date_mismatch: 'The check-in date does not match our records. Please verify and try again.',

    // Guest contact info
    guest_contact_title: 'Contact Information',
    guest_contact_explanation: 'These details are required to confirm your transfer and allow the driver to contact you if needed.',
    guest_email_label: 'Email',
    guest_email_placeholder: 'your.email@example.com',
    guest_whatsapp_label: 'WhatsApp Number',
    guest_whatsapp_placeholder: '+33 6 00 00 00 00',
    guest_comment_label: 'Additional Comments',
    guest_comment_placeholder: 'Any special requests or additional information...',
    
    // Transport form
    transport_details: 'Transport Details',
    select_transport_type: 'Select Transport Type',
    transport_date: 'Transport Date',
    transport_time: 'Arrival Time',
    passengers: 'Number of Passengers',
    price_calculation: 'Price Calculation',
    total_price: 'Total Price',
    payment_at_riad: 'Payment at Property',
    payment_to_driver: 'Payment to Driver',
    
    // Transport types
    airport_pickup: 'Airport Pickup',
    train_station_pickup: 'Train Station Pickup',
    hotel_pickup: 'Hotel Pickup',
    bus_station_pickup: 'Bus Station Pickup',
    
    // Dynamic fields
    flight_number: 'Flight Number',
    arrival_time: 'Arrival Time',
    train_number: 'Train Number',
    hotel_name: 'Hotel Name',
    hotel_address: 'Hotel Address',
    bus_company: 'Bus Company',
    
    // Confirmation
    request_submitted: 'Request Submitted',
    request_submitted_message: 'Your transport request has been submitted. You will receive confirmation soon.',
    request_pending: 'Pending confirmation from the property.',
    
    // Warnings
    late_booking_warning: 'This is a same-day booking. Please contact the property directly for urgent requests.',
    contact_whatsapp: 'Contact via WhatsApp',
    
    // Status
    status_pending: 'Pending',
    status_confirmed: 'Confirmed',
    status_rejected: 'Rejected',
    status_canceled: 'Canceled',
    status_cancelled: 'Cancelled',
    status_canceled_due_to_reservation: 'Cancelled (Reservation)',
    
    // Cancel transport
    cancel_transport: 'Cancel Transport',
    cancel_transport_confirm: 'Are you sure you want to cancel this transport?',
    cancel_reason_label: 'Cancellation Reason',
    cancel_reason_placeholder: 'Enter reason for cancellation...',
    transport_cancelled: 'Transport cancelled successfully',
    
    // Back-office menu
    today_transfers: 'Today',
    tomorrow_transfers: 'Tomorrow',
    upcoming_transfers: 'Upcoming',
    pending_requests: 'Pending Requests',
    all_requests: 'All Requests',
    search_placeholder: 'Search requests...',
    
    // Back-office
    dashboard: 'Dashboard',
    logout: 'Logout',
    login: 'Login',
    email: 'Email',
    password: 'Password',
    sign_in: 'Sign In',
    sign_up: 'Sign Up',
    no_requests: 'No transport requests found.',
    rejection_reason: 'Rejection Reason',
    rejection_reason_placeholder: 'Please provide a reason for rejection',
    confirm_transport: 'Confirm Transport',
    reject_transport: 'Reject Transport',
    edit_transport: 'Edit Transport',
    guest_info: 'Guest Information',
    transport_info: 'Transport Information',
    reservation_ref: 'Reservation',
    
    // Validation
    required_field: 'This field is required',
    invalid_email: 'Please enter a valid email',
    min_passengers: 'Minimum 1 passenger required',
  },
  fr: {
    // Common
    app_name: 'MargoFlow',
    loading: 'Chargement...',
    error: 'Une erreur est survenue',
    submit: 'Soumettre',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    reject: 'Rejeter',
    save: 'Enregistrer',
    back: 'Retour',
    next: 'Suivant',
    
    // Landing page intro
    intro_line_1: 'Margo Flow nous aide à organiser votre arrivée en douceur.',
    intro_line_2: 'Votre propriété est partenaire de MargoFlow et utilise cette plateforme pour gérer et organiser les transferts d\'arrivée de ses clients, garantissant une expérience fluide et sans tracas.',
    intro_line_3: 'Veuillez entrer les informations ci-dessous, et nous nous occuperons du reste.',
    
    // Footer
    footer_copyright: '© 2025 – Créé avec Amour 💙 par',
    footer_margo: 'Margo Hospitality',
    
    // Admin
    admin_users: 'Gestion des Utilisateurs',
    admin_find_user: 'Rechercher un utilisateur par email',
    admin_search: 'Rechercher',
    admin_user_not_found: 'Utilisateur non trouvé',
    admin_assign_role: 'Attribuer le Rôle',
    admin_assign_riads: 'Attribuer les Propriétés',
    admin_save_changes: 'Enregistrer',
    admin_role_pending: 'En attente',
    admin_role_manager: 'Manager',
    admin_role_super_admin: 'Super Admin',
    admin_no_access: 'Vous n\'avez pas accès à cette zone.',
    admin_pending_notice: 'Votre compte est en attente d\'approbation. Veuillez contacter un administrateur.',
    
    // Guest flow
    welcome_title: 'Transport à l\'arrivée',
    welcome_subtitle: 'Réservez votre transfert confortable vers la propriété',
    select_riad: 'Veuillez sélectionner votre propriété',
    reservation_lookup: 'Demandez votre transfert',
    riad_name_label: 'Nom de la Propriété',
    riad_name_placeholder: 'Commencez à taper pour rechercher...',
    no_riads_found: 'Aucune propriété trouvée',
    reservation_id_label: 'Numéro de Réservation',
    reservation_id_placeholder: 'Entrez votre ID de confirmation',
    check_in_date_label: 'Date d\'arrivée',
    check_in_date_placeholder: 'Sélectionnez votre date d\'arrivée',
    check_in_date_required: 'Veuillez sélectionner votre date d\'arrivée',
    last_name_label: 'Nom de famille',
    last_name_placeholder: 'Entrez votre nom de famille',
    find_reservation: 'Trouver la réservation',
    reservation_not_found: 'Réservation non trouvée. Veuillez vérifier vos informations.',
    reservation_invalid: 'Cette réservation n\'est plus valide.',
    too_many_requests: 'Trop de tentatives. Veuillez patienter {seconds} secondes.',
    verification_required: 'Vérification requise. Veuillez compléter le contrôle de sécurité.',
    verify_human: 'Vérification de sécurité',
    complete_captcha: 'Veuillez compléter la vérification ci-dessus.',
    captcha_required: 'Veuillez compléter la vérification pour continuer.',
    existing_request: 'Une demande de transport existe déjà pour cette réservation.',
    rate_limited: 'Trop de tentatives. Veuillez patienter un moment.',
    check_in_date_mismatch: 'La date d\'arrivée ne correspond pas à nos enregistrements. Veuillez vérifier et réessayer.',

    // Guest contact info
    guest_contact_title: 'Coordonnées',
    guest_contact_explanation: 'Ces informations sont nécessaires pour confirmer votre transfert et permettre au chauffeur de vous contacter si besoin.',
    guest_email_label: 'Email',
    guest_email_placeholder: 'votre.email@exemple.com',
    guest_whatsapp_label: 'Numéro WhatsApp',
    guest_whatsapp_placeholder: '+33 6 00 00 00 00',
    guest_comment_label: 'Commentaires Additionnels',
    guest_comment_placeholder: 'Demandes spéciales ou informations supplémentaires...',
    
    // Transport form
    transport_details: 'Détails du Transport',
    select_transport_type: 'Sélectionnez le Type de Transport',
    transport_date: 'Date du Transport',
    transport_time: 'Heure d\'Arrivée',
    passengers: 'Nombre de Passagers',
    price_calculation: 'Calcul du Prix',
    total_price: 'Prix Total',
    payment_at_riad: 'Paiement à la Propriété',
    payment_to_driver: 'Paiement au Chauffeur',
    
    // Transport types
    airport_pickup: 'Transfert Aéroport',
    train_station_pickup: 'Transfert Gare',
    hotel_pickup: 'Transfert Hôtel',
    bus_station_pickup: 'Transfert Gare Routière',
    
    // Dynamic fields
    flight_number: 'Numéro de Vol',
    arrival_time: 'Heure d\'Arrivée',
    train_number: 'Numéro de Train',
    hotel_name: 'Nom de l\'Hôtel',
    hotel_address: 'Adresse de l\'Hôtel',
    bus_company: 'Compagnie de Bus',
    
    // Confirmation
    request_submitted: 'Demande Soumise',
    request_submitted_message: 'Votre demande de transport a été soumise. Vous recevrez bientôt une confirmation.',
    request_pending: 'En attente de confirmation de la propriété.',
    
    // Warnings
    late_booking_warning: 'Ceci est une réservation pour aujourd\'hui. Veuillez contacter la propriété directement pour les demandes urgentes.',
    contact_whatsapp: 'Contacter via WhatsApp',
    
    // Status
    status_pending: 'En attente',
    status_confirmed: 'Confirmé',
    status_rejected: 'Rejeté',
    status_canceled: 'Annulé',
    status_cancelled: 'Annulé',
    status_canceled_due_to_reservation: 'Annulé (Réservation)',
    
    // Cancel transport
    cancel_transport: 'Annuler le Transport',
    cancel_transport_confirm: 'Êtes-vous sûr de vouloir annuler ce transport ?',
    cancel_reason_label: 'Motif d\'annulation',
    cancel_reason_placeholder: 'Entrez le motif d\'annulation...',
    transport_cancelled: 'Transport annulé avec succès',
    
    // Back-office menu
    today_transfers: 'Aujourd\'hui',
    tomorrow_transfers: 'Demain',
    upcoming_transfers: 'À venir',
    pending_requests: 'Demandes en Attente',
    all_requests: 'Toutes les Demandes',
    search_placeholder: 'Rechercher des demandes...',
    
    // Back-office
    dashboard: 'Tableau de Bord',
    logout: 'Déconnexion',
    login: 'Connexion',
    email: 'Email',
    password: 'Mot de passe',
    sign_in: 'Se Connecter',
    sign_up: 'S\'inscrire',
    no_requests: 'Aucune demande de transport trouvée.',
    rejection_reason: 'Motif de Rejet',
    rejection_reason_placeholder: 'Veuillez fournir un motif de rejet',
    confirm_transport: 'Confirmer le Transport',
    reject_transport: 'Rejeter le Transport',
    edit_transport: 'Modifier le Transport',
    guest_info: 'Informations Client',
    transport_info: 'Informations Transport',
    reservation_ref: 'Réservation',
    
    // Validation
    required_field: 'Ce champ est requis',
    invalid_email: 'Veuillez entrer un email valide',
    min_passengers: 'Minimum 1 passager requis',
  }
} as const;

export function getLanguageFromUrl(): Language {
  if (typeof window === 'undefined') return 'en';
  const params = new URLSearchParams(window.location.search);
  const lang = params.get('lang');
  return lang === 'fr' ? 'fr' : 'en';
}

export function t(key: keyof typeof translations.en, lang: Language = 'en'): string {
  return translations[lang][key] || translations.en[key] || key;
}
