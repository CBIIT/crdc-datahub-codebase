import React, { FC, memo } from "react";

export type RepeaterProps = {
  /**
   * The number of times the component should be repeated
   */
  count: number;
  /**
   * The component that should be repeated N times
   */
  children: React.ReactElement;
  /**
   * An optional prefix for the repeated component's key
   *
   * @example "my-component"
   */
  keyPrefix?: string;
};

/**
 * A component wrapper that repeats it's children N number of times
 *
 * @returns The Repeater component
 */
const Repeater: FC<RepeaterProps> = ({
  count,
  children,
  keyPrefix = "repeater",
}: RepeaterProps) => (
  <>
    {Array.from({ length: count }, (_, index) =>
      React.cloneElement(children, { key: `${keyPrefix}-${index}` })
    )}
  </>
);

export default memo<RepeaterProps>(Repeater);
