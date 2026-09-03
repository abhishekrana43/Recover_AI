"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PromiseToPay = {
  id: string;
  recoveryCaseId: string;
  paymentId: string;
  amount: number;
  currency: string;
  promisedFor: string;
  status: string;
  source: string;
  notes: string | null;
  fulfilledAt: string | null;
  brokenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type RecoveryAction = {
  id: string;
  recoveryCaseId: string;
  type: string;
  status: string;
  payload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error: string | null;
  retryCount: number;
  externalProviderId: string | null;
  idempotencyKey: string | null;
  scheduledFor: string | null;
  approvalRequired: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  approvalReason: string | null;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lockedAt: string | null;
};

type VoiceCall = {
  id: string;
  recoveryCaseId: string;
  provider: string;
  providerCallId: string;
  status: string;
  phoneNumber: string;
  startedAt: string | null;
  answeredAt: string | null;
  completedAt: string | null;
  transcript: string | null;
  outcome: string | null;
  outcomeData: Record<string, unknown> | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type AuditLog = {
  id: string;
  merchantId: string;
  entityType: string;
  entityId: string;
  action: string;
  metadata: Record<string, unknown> | null;
  actorType: string | null;
  actorId: string | null;
  source: string | null;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  createdAt: string;
};

type RecoveryCaseDetail = {
  success: boolean;

  recoveryCase: {
    id: string;
    status: string;
    amountAtRisk: number;
    amountRecovered: number;
    failureReason: string | null;
    closureReason: string | null;
    createdAt: string;
    resolvedAt: string | null;
  };

  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  } | null;

  payment: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    razorpayPaymentId: string | null;
    failureReason: string | null;
  };

  promises: PromiseToPay[];
  actions: RecoveryAction[];
  voiceCalls: VoiceCall[];
  auditLogs: AuditLog[];
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

function formatINR(amountInPaise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountInPaise / 100);
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function badgeClass(status: string) {
  switch (status) {
    case "RECOVERED":
    case "CAPTURED":
    case "FULFILLED":
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";

    case "ESCALATED":
    case "PENDING":
      return "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300";

    case "FAILED":
    case "REJECTED":
      return "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300";

    case "IN_PROGRESS":
    case "PROCESSING":
    case "QUEUED":
      return "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300";

    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
          {title}
        </h2>
      </div>

      <div className="p-6">{children}</div>
    </section>
  );
}

export default function RecoveryCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [data, setData] =
    useState<RecoveryCaseDetail | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [caseId, setCaseId] =
    useState<string>("");

  // const [darkMode, setDarkMode] =
  //   useState(false);

  // useEffect(() => {
  //   const savedTheme =
  //     localStorage.getItem(
  //       "recover-ai-theme"
  //     );

  //   const shouldUseDark =
  //     savedTheme === "dark";

  //   setDarkMode(shouldUseDark);

  //   document.documentElement.classList.toggle(
  //     "dark",
  //     shouldUseDark
  //   );
  // }, []);

  useEffect(() => {
  const savedTheme =
    localStorage.getItem(
      "recover-ai-theme"
    );

  const shouldUseDark =
    savedTheme === "dark";

  document.documentElement.classList.toggle(
    "dark",
    shouldUseDark
  );
}, []);

  // function toggleTheme() {
  //   setDarkMode((current) => {
  //     const next = !current;

  //     document.documentElement.classList.toggle(
  //       "dark",
  //       next
  //     );

  //     localStorage.setItem(
  //       "recover-ai-theme",
  //       next ? "dark" : "light"
  //     );

  //     return next;
  //   });
  // }
  function toggleTheme() {
  const next =
    !document.documentElement.classList.contains(
      "dark"
    );

  document.documentElement.classList.toggle(
    "dark",
    next
  );

  localStorage.setItem(
    "recover-ai-theme",
    next ? "dark" : "light"
  );
}

  useEffect(() => {
    async function loadCase() {
      try {
        const resolvedParams = await params;
        const id = resolvedParams.id;

        setCaseId(id);

        const response = await fetch(
          `${API_URL}/api/recovery/cases/${encodeURIComponent(
            id
          )}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Recovery case API returned ${response.status}`
          );
        }

        const result =
          (await response.json()) as RecoveryCaseDetail;

        if (!result.success) {
          throw new Error(
            "Invalid recovery case response"
          );
        }

        setData(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load recovery case"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadCase();
  }, [params]);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 text-zinc-950 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Loading recovery case...
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-zinc-50 text-zinc-950 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              ← Back to dashboard
            </Link>

            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <span className="dark:hidden">
                           ☾ Dark
               </span>

              <span className="hidden dark:inline">
                            ☀ Light
              </span>
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/40">
            <p className="font-medium text-red-800 dark:text-red-300">
              Unable to load recovery case
            </p>

            <p className="mt-1 text-sm text-red-700 dark:text-red-400">
              {error ?? "Recovery case not found"}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const {
    recoveryCase,
    customer,
    payment,
    promises,
    actions,
    voiceCalls,
    auditLogs,
  } = data;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Back to dashboard
          </Link>

          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Toggle theme"
          >
            <span className="dark:hidden">
                            ☾ Dark
            </span>

            <span className="hidden dark:inline">
                           ☀ Light
            </span>
          </button>
        </div>

        {/* Header */}
        <header className="mt-5 flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-zinc-800">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              Recovery Case
            </p>

            <h1 className="mt-2 break-all text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100 sm:text-3xl">
              {recoveryCase.id}
            </h1>

            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Created {formatDate(recoveryCase.createdAt)}
            </p>
          </div>

          <span
            className={`w-fit rounded-full px-4 py-2 text-sm font-medium ${badgeClass(
              recoveryCase.status
            )}`}
          >
            {recoveryCase.status}
          </span>
        </header>

        {/* Summary */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Amount at risk
            </p>

            <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-100">
              {formatINR(
                recoveryCase.amountAtRisk
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Amount recovered
            </p>

            <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-100">
              {formatINR(
                recoveryCase.amountRecovered
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Payment
            </p>

            <span
              className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${badgeClass(
                payment.status
              )}`}
            >
              {payment.status}
            </span>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Resolved
            </p>

            <p className="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-100">
              {formatDate(
                recoveryCase.resolvedAt
              )}
            </p>
          </div>
        </section>

        {/* Customer + Payment */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Section title="Customer">
            {customer ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Name
                  </span>

                  <span className="text-right font-medium text-zinc-950 dark:text-zinc-100">
                    {customer.name}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Email
                  </span>

                  <span className="break-all text-right font-medium text-zinc-950 dark:text-zinc-100">
                    {customer.email}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Phone
                  </span>

                  <span className="text-right font-medium text-zinc-950 dark:text-zinc-100">
                    {customer.phone ?? "—"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Customer information unavailable.
              </p>
            )}
          </Section>

          <Section title="Payment">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Amount
                </span>

                <span className="font-medium text-zinc-950 dark:text-zinc-100">
                  {formatINR(payment.amount)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Currency
                </span>

                <span className="font-medium text-zinc-950 dark:text-zinc-100">
                  {payment.currency}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Status
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${badgeClass(
                    payment.status
                  )}`}
                >
                  {payment.status}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Razorpay payment ID
                </span>

                <span className="break-all text-right font-medium text-zinc-950 dark:text-zinc-100">
                  {payment.razorpayPaymentId ?? "—"}
                </span>
              </div>

              {payment.failureReason ? (
                <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <p className="text-zinc-500 dark:text-zinc-400">
                    Failure reason
                  </p>

                  <p className="mt-1 text-zinc-800 dark:text-zinc-200">
                    {payment.failureReason}
                  </p>
                </div>
              ) : null}
            </div>
          </Section>
        </div>

        {/* Promise to Pay */}
        <div className="mt-6">
          <Section title="Promise to Pay">
            {promises.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No promise-to-pay records.
              </p>
            ) : (
              <div className="space-y-4">
                {promises.map((promise) => (
                  <div
                    key={promise.id}
                    className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-zinc-950 dark:text-zinc-100">
                          Promised for{" "}
                          {formatDate(
                            promise.promisedFor
                          )}
                        </p>

                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                          Source: {promise.source}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${badgeClass(
                          promise.status
                        )}`}
                      >
                        {promise.status}
                      </span>
                    </div>

                    {promise.notes ? (
                      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
                        {promise.notes}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Recovery Actions */}
        <div className="mt-6">
          <Section title="Recovery Actions">
            {actions.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No recovery actions recorded.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      <th className="px-4 py-3 font-medium">
                        Type
                      </th>

                      <th className="px-4 py-3 font-medium">
                        Status
                      </th>

                      <th className="px-4 py-3 font-medium">
                        Approval
                      </th>

                      <th className="px-4 py-3 font-medium">
                        Executed
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {actions.map((action) => (
                      <tr
                        key={action.id}
                        className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                      >
                        <td className="px-4 py-4 font-medium text-zinc-950 dark:text-zinc-100">
                          {action.type}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${badgeClass(
                              action.status
                            )}`}
                          >
                            {action.status}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-zinc-700 dark:text-zinc-300">
                          {action.approvalRequired
                            ? action.approvedAt
                              ? "Approved"
                              : action.rejectedAt
                                ? "Rejected"
                                : "Required"
                            : "Not required"}
                        </td>

                        <td className="px-4 py-4 text-zinc-500 dark:text-zinc-400">
                          {formatDate(
                            action.executedAt
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        {/* Voice Calls */}
        <div className="mt-6">
          <Section title="Voice Calls">
            {voiceCalls.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No voice calls recorded.
              </p>
            ) : (
              <div className="space-y-4">
                {voiceCalls.map((call) => (
                  <div
                    key={call.id}
                    className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-zinc-950 dark:text-zinc-100">
                          {call.provider}
                        </p>

                        <p className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">
                          {call.providerCallId}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${badgeClass(
                          call.status
                        )}`}
                      >
                        {call.status}
                      </span>
                    </div>

                    {call.outcome ? (
                      <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                        Outcome:{" "}
                        <span className="font-medium text-zinc-950 dark:text-zinc-100">
                          {call.outcome}
                        </span>
                      </p>
                    ) : null}

                    {call.transcript ? (
                      <div className="mt-4 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800">
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Transcript
                        </p>

                        <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                          {call.transcript}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Audit Trail */}
        <div className="mt-6">
          <Section title="Audit Trail">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No audit entries found.
              </p>
            ) : (
              <div className="relative space-y-5">
                {auditLogs.map((log, index) => (
                  <div
                    key={log.id}
                    className="relative flex gap-4"
                  >
                    <div className="flex flex-col items-center">
                      <div className="mt-1 h-3 w-3 rounded-full bg-zinc-950 dark:bg-zinc-100" />

                      {index !==
                      auditLogs.length - 1 ? (
                        <div className="h-full w-px bg-zinc-200 dark:bg-zinc-800" />
                      ) : null}
                    </div>

                    <div className="min-w-0 pb-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="font-medium text-zinc-950 dark:text-zinc-100">
                          {log.action}
                        </p>

                        <span className="text-xs text-zinc-400">
                          {formatDate(log.createdAt)}
                        </span>
                      </div>

                      {log.source ? (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          Source: {log.source}
                        </p>
                      ) : null}

                      {log.metadata ? (
                        <pre className="mt-3 max-w-full overflow-x-auto rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {JSON.stringify(
                            log.metadata,
                            null,
                            2
                          )}
                        </pre>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <p className="mt-6 text-xs text-zinc-400 dark:text-zinc-600">
          Case: {caseId}
        </p>
      </div>
    </main>
  );
}