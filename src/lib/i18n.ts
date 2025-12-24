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
    admin_assign_riads: 'Assign Riads',
    admin_save_changes: 'Save Changes',
    admin_role_pending: 'Pending',
    admin_role_manager: 'Manager',
    admin_role_super_admin: 'Super Admin',
    admin_no_access: 'You do not have access to this area.',
    admin_pending_notice: 'Your account is pending approval. Please contact an administrator.',
    
    // Guest flow
    welcome_title: 'Arrival Transport',
    welcome_subtitle: 'Book your comfortable transfer to the riad',
    select_riad: 'Please select your riad',
    reservation_lookup: 'Request your transfer',
    riad_name_label: 'Property Name',
    riad_name_placeholder: 'Start typing to search...',
    no_riads_found: 'No riads found',
    reservation_id_label: 'Reservation Number',
    reservation_id_placeholder: 'Enter your booking confirmation ID',
    last_name_label: 'Last Name',
    last_name_placeholder: 'Enter your last name',
    find_reservation: 'Find Reservation',
    reservation_not_found: 'Reservation not found. Please check your details.',
    reservation_invalid: 'This reservation is no longer valid.',
    existing_request: 'A transport request already exists for this reservation.',
    
    // Transport form
    transport_details: 'Transport Details',
    select_transport_type: 'Select Transport Type',
    transport_date: 'Transport Date',
    transport_time: 'Pickup Time',
    passengers: 'Number of Passengers',
    price_calculation: 'Price Calculation',
    total_price: 'Total Price',
    payment_at_riad: 'Payment at Riad',
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
    request_pending: 'Pending confirmation from the riad.',
    
    // Warnings
    late_booking_warning: 'This is a same-day booking. Please contact the riad directly for urgent requests.',
    contact_whatsapp: 'Contact via WhatsApp',
    
    // Status
    status_pending: 'Pending',
    status_confirmed: 'Confirmed',
    status_rejected: 'Rejected',
    status_canceled: 'Canceled',
    
    // Back-office
    dashboard: 'Dashboard',
    pending_requests: 'Pending Requests',
    all_requests: 'All Requests',
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
    admin_assign_riads: 'Attribuer les Riads',
    admin_save_changes: 'Enregistrer',
    admin_role_pending: 'En attente',
    admin_role_manager: 'Manager',
    admin_role_super_admin: 'Super Admin',
    admin_no_access: 'Vous n\'avez pas accès à cette zone.',
    admin_pending_notice: 'Votre compte est en attente d\'approbation. Veuillez contacter un administrateur.',
    
    // Guest flow
    welcome_title: 'Transport à l\'arrivée',
    welcome_subtitle: 'Réservez votre transfert confortable vers le riad',
    select_riad: 'Veuillez sélectionner votre riad',
    reservation_lookup: 'Demandez votre transfert',
    riad_name_label: 'Nom de la Propriété',
    riad_name_placeholder: 'Commencez à taper pour rechercher...',
    no_riads_found: 'Aucun riad trouvé',
    reservation_id_label: 'Numéro de Réservation',
    reservation_id_placeholder: 'Entrez votre ID de confirmation',
    last_name_label: 'Nom de famille',
    last_name_placeholder: 'Entrez votre nom de famille',
    find_reservation: 'Trouver la réservation',
    reservation_not_found: 'Réservation non trouvée. Veuillez vérifier vos informations.',
    reservation_invalid: 'Cette réservation n\'est plus valide.',
    existing_request: 'Une demande de transport existe déjà pour cette réservation.',
    
    // Transport form
    transport_details: 'Détails du Transport',
    select_transport_type: 'Sélectionnez le Type de Transport',
    transport_date: 'Date du Transport',
    transport_time: 'Heure de Prise en Charge',
    passengers: 'Nombre de Passagers',
    price_calculation: 'Calcul du Prix',
    total_price: 'Prix Total',
    payment_at_riad: 'Paiement au Riad',
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
    request_pending: 'En attente de confirmation du riad.',
    
    // Warnings
    late_booking_warning: 'Ceci est une réservation pour aujourd\'hui. Veuillez contacter le riad directement pour les demandes urgentes.',
    contact_whatsapp: 'Contacter via WhatsApp',
    
    // Status
    status_pending: 'En attente',
    status_confirmed: 'Confirmé',
    status_rejected: 'Rejeté',
    status_canceled: 'Annulé',
    
    // Back-office
    dashboard: 'Tableau de Bord',
    pending_requests: 'Demandes en Attente',
    all_requests: 'Toutes les Demandes',
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
