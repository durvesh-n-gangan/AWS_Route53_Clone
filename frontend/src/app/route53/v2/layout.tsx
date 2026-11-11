import { ConsoleShell } from "@/components/layout/ConsoleShell";

export default function ConsoleLayout({ children }: LayoutProps<"/route53/v2">) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
