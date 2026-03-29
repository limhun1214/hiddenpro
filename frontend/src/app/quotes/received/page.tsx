export const runtime = "edge";
import { Suspense } from "react";
import CustomerQuotesClient from "./CustomerQuotesClient";

export default function CustomerQuotesPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full overflow-y-auto bg-[#0f0d13]">
      <Suspense
        fallback={
          <div className="p-8 text-center text-[#aea9b2] flex-1 flex flex-col justify-center min-h-0 bg-[#0f0d13]">
            Loading...
          </div>
        }
      >
        <CustomerQuotesClient />
      </Suspense>
    </div>
  );
}
