import { COMPANY_NAME } from "@/lib/config";

export function Brand({ href }: { href?: string }) {
  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/feather-black.png" alt="" />
      <span>{COMPANY_NAME}</span>
    </>
  );
  return href ? (
    <a href={href} className="brand">{inner}</a>
  ) : (
    <div className="brand">{inner}</div>
  );
}
