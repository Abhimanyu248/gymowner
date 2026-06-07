export const STORAGE_KEYS = {
  members: 'gym-members',
  membershipTypes: 'gym-membership-types',
};

export const defaultMembershipTypes = [
  { id: 'plan-1', name: 'Monthly', durationMonths: '1', amount: '1500' },
  { id: 'plan-2', name: 'Quarterly', durationMonths: '3', amount: '4000' },
  { id: 'plan-3', name: 'Half-Yearly', durationMonths: '6', amount: '7500' },
  { id: 'plan-4', name: 'Yearly', durationMonths: '12', amount: '14000' },
];

export const menuOptions = [
  { key: 'view', label: 'Members', icon: 'person-outline', activeIcon: 'person' },
  { key: 'add', label: 'Add', icon: 'person-add-outline', activeIcon: 'person-add' },
  { key: 'types', label: 'Plans', icon: 'grid-outline', activeIcon: 'grid' },
  { key: 'menu', label: 'Menu', icon: 'menu-outline', activeIcon: 'menu' },
];

export const initialMembers = [
  {
    id: '1',
    name: 'Rahul Sharma',
    joinDate: '2026-04-01',
    expiryDate: '2026-05-01',
    membershipType: 'Monthly',
    address: 'Andheri West, Mumbai',
    age: '26',
    weight: '74',
    imageUrl:
      'https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: '2',
    name: 'Ananya Verma',
    joinDate: '2026-03-15',
    expiryDate: '2026-09-15',
    membershipType: 'Half-Yearly',
    address: 'Salt Lake, Kolkata',
    age: '24',
    weight: '58',
    imageUrl:
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=500&q=80',
  },
];
