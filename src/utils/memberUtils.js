import { defaultMembershipTypes } from '../data/defaultData';

export const createEmptyForm = (membershipTypes) => ({
  name: '',
  joinDate: '',
  membershipType: membershipTypes[0]?.name || '',
  address: '',
  age: '',
  weight: '',
  imageUrl: '',
});

export const createEmptyPlanForm = () => ({
  name: '',
  durationMonths: '',
  amount: '',
});

export const createEmptyRenewForm = (membershipTypes) => ({
  membershipType: membershipTypes[0]?.name || '',
  joinDate: '',
});

export const normalizeMembershipTypes = (savedTypes) => {
  if (!Array.isArray(savedTypes) || !savedTypes.length) {
    return defaultMembershipTypes;
  }

  return savedTypes.map((type, index) => {
    if (typeof type === 'string') {
      return {
        id: `plan-${index + 1}-${type.toLowerCase().replace(/\s+/g, '-')}`,
        name: type,
        durationMonths: '',
        amount: '',
      };
    }

    return {
      id: type.id || `plan-${index + 1}`,
      name: type.name || `Plan ${index + 1}`,
      durationMonths: type.durationMonths?.toString() || '',
      amount: type.amount?.toString() || '',
    };
  });
};

export const sortMembershipTypesByDuration = (plans) =>
  [...plans].sort((firstPlan, secondPlan) => {
    const firstDuration = parseInt(firstPlan.durationMonths, 10);
    const secondDuration = parseInt(secondPlan.durationMonths, 10);
    const safeFirstDuration = Number.isNaN(firstDuration) ? Number.MAX_SAFE_INTEGER : firstDuration;
    const safeSecondDuration = Number.isNaN(secondDuration) ? Number.MAX_SAFE_INTEGER : secondDuration;
    return safeFirstDuration - safeSecondDuration;
  });

export const formatDateLabel = (dateValue) => {
  if (!dateValue) {
    return 'Select joining date';
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return 'Select joining date';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const formatStorageDate = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const addMonthsToDate = (dateValue, monthsToAdd) => {
  const date = new Date(dateValue);
  const originalDay = date.getDate();
  date.setMonth(date.getMonth() + monthsToAdd);

  if (date.getDate() < originalDay) {
    date.setDate(0);
  }

  // Adjust so expiry is 1 day before the join date day
  date.setDate(date.getDate() - 1);

  return date;
};

export const calculateExpiryDate = (joinDate, membershipType, plans) => {
  const selectedPlan = plans.find((plan) => plan.name === membershipType);
  const durationMonths = parseInt(selectedPlan?.durationMonths, 10);

  if (!joinDate || Number.isNaN(durationMonths)) {
    return '';
  }

  return formatStorageDate(addMonthsToDate(joinDate, durationMonths));
};

export const calculateDaysLeft = (expiryDate) => {
  const expiry = new Date(expiryDate);

  if (Number.isNaN(expiry.getTime())) {
    return null;
  }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const expiryStart = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());

  return Math.ceil((expiryStart - todayStart) / (1000 * 60 * 60 * 24));
};
