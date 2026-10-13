/**
 * SoulLetter UI primitives. Import from "@/components/ui".
 *
 * Client-only modules (Button, Disclosure, Field, RadioGroup, Reveal) carry their own
 * "use client" directive, so everything here can be rendered from Server Components as long
 * as only serialisable props are passed.
 */
export { cn, type ClassValue } from "./cn";

export { Button, type ButtonProps } from "./Button";
export { ButtonLink, type ButtonLinkProps } from "./ButtonLink";
export { buttonStyles, type ButtonSize, type ButtonStyleOptions, type ButtonVariant } from "./button-styles";

export {
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  type CardBodyProps,
  type CardDescriptionProps,
  type CardElement,
  type CardFooterProps,
  type CardHeaderProps,
  type CardPadding,
  type CardProps,
  type CardTitleProps,
  type CardVariant,
} from "./Card";

export { Badge, type BadgeProps, type BadgeSize, type BadgeTone } from "./Badge";
export {
  StatusBadge,
  VERIFICATION_STATUS_DESCRIPTIONS,
  VERIFICATION_STATUS_LABELS,
  getVerificationStatusLabel,
  type StatusBadgeProps,
} from "./StatusBadge";

export { Callout, type CalloutProps, type CalloutTone } from "./Callout";
export { Disclosure, type DisclosureProps } from "./Disclosure";

export {
  Checkbox,
  Field,
  FieldError,
  FieldHint,
  Input,
  Label,
  Select,
  Textarea,
  useFieldIds,
  type CheckboxProps,
  type FieldControlProps,
  type FieldErrorProps,
  type FieldHintProps,
  type FieldIds,
  type FieldProps,
  type InputProps,
  type LabelProps,
  type SelectProps,
  type TextareaProps,
} from "./Field";
export { RadioCard, RadioGroup, type RadioCardProps, type RadioGroupProps } from "./RadioGroup";
export { fieldA11yProps, joinIds, type FieldA11yOptions, type FieldA11yProps } from "./field-a11y";

export { ProgressSteps, type ProgressStep, type ProgressStepsProps } from "./ProgressSteps";
export { Spinner, type SpinnerProps, type SpinnerSize } from "./Spinner";
export { VisuallyHidden, type VisuallyHiddenProps } from "./VisuallyHidden";
export { Divider, type DividerProps } from "./Divider";
export { Reveal, type RevealProps } from "./Reveal";

export * from "./icons";
