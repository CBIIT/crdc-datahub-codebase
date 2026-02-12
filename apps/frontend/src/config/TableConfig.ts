export const SORT: { [key in Order as Uppercase<Order>]: Order } = {
  ASC: "asc",
  DESC: "desc",
};

export const DIRECTION: { [key in Order as Uppercase<Order>]: number } = {
  ASC: 1,
  DESC: -1,
};
