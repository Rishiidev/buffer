"use client";

import { Toaster } from "sonner";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-center"
        theme="dark"
        toastOptions={{
          style: {
            background: "#15161a",
            color: "#f5f5f7",
            border: "1px solid #26272d",
            borderRadius: "14px",
          },
        }}
      />
    </>
  );
}
