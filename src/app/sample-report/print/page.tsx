import type { Metadata } from "next";
import { PrintReport } from "@/components/result/PrintReport";
import { SAMPLE_RESULT } from "@/lib/sample-result";

export const metadata: Metadata = { title: "Sample report · PDF", robots: { index: false } };

export default function SamplePrintPage() {
  return <PrintReport data={SAMPLE_RESULT} />;
}
