export const runtime = "edge";
import dynamic from "next/dynamic";

const DynamicRequestForm = dynamic(
  () => import("@/components/customer/DynamicRequestForm"),
  { ssr: false },
);

export default function RequestPage() {
  return <DynamicRequestForm />;
}
