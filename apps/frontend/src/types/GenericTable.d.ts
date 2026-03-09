type PaginationPosition = "top" | "bottom" | "both";

type Order = "asc" | "desc";

type FetchListing<T> = {
  first: number;
  offset: number;
  sortDirection: Order;
  orderBy: string;
  comparator?: (a: T, b: T) => number;
};

type TableMethods = {
  refresh: () => void;
  setPage: (page: number, forceRefetch?: boolean) => void;
  tableParams: TableParams;
};

type TableParams = {
  page: number;
  perPage: number;
  sortDirection: Order;
  orderBy: string;
};

type TableState<T> = {
  data: T[];
  total: number;
  perPageOptions: number[];
} & TableParams;

type FilterFunction<T> = (item: T) => boolean;

type ColumnVisibilityModel = { [key: string]: boolean };

type VerticalPlacement = "top" | "bottom";

type AdditionalActions = {
  before?: React.ReactNode;
  after?: React.ReactNode;
};

type AdditionalActionsConfig = Partial<Record<VerticalPlacement, AdditionalActions>>;
