import { Button, Flex } from "@strapi/design-system";
import { createContext, type ReactNode, useContext } from "react";

// Single-select segmented control, modelled after the `SegmentedControl` from
// strapi-design-extended but built only on design-system primitives.

type ContextValue = { value: string; onChange: (value: string) => void };

const SegmentedControlContext = createContext<ContextValue | null>(null);

interface RootProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  children: ReactNode;
}

const Root = ({ value, onChange, label, children }: RootProps) => (
  <SegmentedControlContext.Provider value={{ value, onChange }}>
    <Flex
      role="group"
      aria-label={label}
      gap={1}
      padding={1}
      background="neutral100"
      borderColor="neutral200"
      borderStyle="solid"
      borderWidth="1px"
      hasRadius
    >
      {children}
    </Flex>
  </SegmentedControlContext.Provider>
);

interface ItemProps {
  value: string;
  disabled?: boolean;
  children: ReactNode;
}

const Item = ({ value, disabled, children }: ItemProps) => {
  const ctx = useContext(SegmentedControlContext);
  if (!ctx) throw new Error("SegmentedControl.Item must be used inside Root");
  const active = ctx.value === value;

  return (
    <Button
      size="S"
      variant={active ? "tertiary" : "ghost"}
      aria-pressed={active}
      disabled={disabled}
      onClick={() => !active && ctx.onChange(value)}
    >
      {children}
    </Button>
  );
};

export const SegmentedControl = { Root, Item };
