export const getStartOfLocalDay = (): Date => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return todayStart;
};

export const getEndOfLocalDay = (): Date => {
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return todayEnd;
};
