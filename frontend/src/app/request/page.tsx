export const runtime = "edge";
import dynamic from "next/dynamic";

const RequestPageGuard = dynamic(
  () => import("@/components/customer/RequestPageGuard"),
  { ssr: false },
);

export default function RequestPage() {
  return <RequestPageGuard />;
}
