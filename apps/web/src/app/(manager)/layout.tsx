"use client";

import React from "react";
import { HubShell } from "@/components/layout/hub-shell";

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HubShell>{children}</HubShell>;
}
