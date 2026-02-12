type WithSingleTypename<T> = {
  withTypename<K extends string>(typename: K): T & { __typename: K };
};

type WithArrayTypename<T> = {
  withTypename<K extends string>(typename: K): Array<T & { __typename: K }>;
};

type BuildableSingle<T> = T & WithSingleTypename<T>;

type BuildableArray<T> = Array<T> & WithArrayTypename<T>;
