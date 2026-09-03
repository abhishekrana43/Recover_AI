"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type RecoveryMetrics = {
  totalCases: number;
  recoveredCases: number;
  openCases: number;
  inProgressCases: number;
  failedCases: number;
  escalatedCases: number;
  closedCases: number;

  totalAmountAtRisk: number;
  totalAmountRecovered: number;

  caseRecoveryRate: number;
  amountRecoveryRate: number;
};

type MetricsResponse = {
  success: boolean;
  metrics: RecoveryMetrics;
};

type RecoveryCase = {
  id: string;
  status: string;
  amountAtRisk: number;
  amountRecovered: number;
  failureReason: string | null;
  closureReason: string | null;
  createdAt: string;
  resolvedAt: string | null;

  payment: {
    id: string;
    amount: number;
    currency: string;
    status: string;
  } | null;

  customer: {
    id: string;
    name: string;
    phone: string | null;
  } | null;

  activePromise: {
    id: string;
    promisedFor: string;
    source: string;
  } | null;
};

type CasesResponse = {
  success: boolean;
  cases: RecoveryCase[];
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

function MetricCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </p>

      <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
        {value}
      </p>

      {subtitle ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function StatusCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 transition-colors dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {label}
        </span>

        <span className="text-xl font-semibold text-zinc-950 dark:text-zinc-100">
          {value}
        </span>
      </div>
    </div>
  );
}

function statusClass(status: string) {
  switch (status) {
    case "RECOVERED":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";

    case "CAPTURED":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";

    case "FULFILLED":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";

    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";

    case "ESCALATED":
      return "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300";

    case "PENDING":
      return "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300";

    case "FAILED":
      return "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300";

    case "IN_PROGRESS":
      return "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300";

    case "QUEUED":
      return "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300";

    case "PROCESSING":
      return "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300";

    case "OPEN":
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

export default function Home() {
  const [metrics, setMetrics] =
    useState<RecoveryMetrics | null>(null);

  const [cases, setCases] =
    useState<RecoveryCase[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  // const [darkMode, setDarkMode] =
  //   useState(false);
  const router = useRouter();

  useEffect(() => {
    const savedTheme =
      localStorage.getItem(
        "recover-ai-theme"
      );

    const shouldUseDark =
      savedTheme === "dark";

    // setDarkMode(shouldUseDark);

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
    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);

        const metricsResponse =
          await fetch(
            `${API_URL}/api/recovery/metrics`,
            {
              cache: "no-store",
            }
          );

        if (!metricsResponse.ok) {
          throw new Error(
            `Metrics API returned ${metricsResponse.status}`
          );
        }

        const metricsData =
          (await metricsResponse.json()) as MetricsResponse;

        if (
          !metricsData.success ||
          !metricsData.metrics
        ) {
          throw new Error(
            "Invalid metrics response"
          );
        }

        setMetrics(metricsData.metrics);

        const casesResponse =
          await fetch(
            `${API_URL}/api/recovery/cases`,
            {
              cache: "no-store",
            }
          );

        if (!casesResponse.ok) {
          throw new Error(
            `Cases API returned ${casesResponse.status}`
          );
        }

        const casesData =
          (await casesResponse.json()) as CasesResponse;

        if (
          !casesData.success ||
          !Array.isArray(casesData.cases)
        ) {
          throw new Error(
            "Invalid recovery cases response"
          );
        }

        setCases(casesData.cases);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load recovery dashboard"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">

        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-zinc-800">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Recover-AI
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100 sm:text-4xl">
              Recovery Operations
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400 sm:text-base">
              Monitor failed payments, recovery outcomes,
              escalations, and money recovered.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              Live recovery metrics
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              aria-label="Toggle theme"
            >
              {/* {darkMode
                ? "☀ Light"
                : "☾ Dark"} */}
              <span className="dark:hidden">
                                 ☾ Dark
               </span>

              <span className="hidden dark:inline">
                                 ☀ Light
               </span>
            </button>
          </div>
        </header>

        {/* Loading */}
        {loading ? (
          <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Loading recovery dashboard...
          </div>
        ) : null}

        {/* Error */}
        {error ? (
          <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/40">
            <p className="font-medium text-red-800 dark:text-red-300">
              Unable to load dashboard
            </p>

            <p className="mt-1 text-sm text-red-700 dark:text-red-400">
              {error}
            </p>

            <p className="mt-3 text-sm text-red-700 dark:text-red-400">
              Make sure the API is running on{" "}
              {API_URL}.
            </p>
          </div>
        ) : null}

        {/* Dashboard */}
        {metrics ? (
          <>
            {/* Primary metrics */}
            <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Total Cases"
                value={metrics.totalCases.toLocaleString(
                  "en-IN"
                )}
              />

              <MetricCard
                label="Amount at Risk"
                value={formatINR(
                  metrics.totalAmountAtRisk
                )}
                subtitle="Across all recovery cases"
              />

              <MetricCard
                label="Amount Recovered"
                value={formatINR(
                  metrics.totalAmountRecovered
                )}
                subtitle="Confirmed recovered payments"
              />

              <MetricCard
                label="Money Recovery"
                value={`${metrics.amountRecoveryRate}%`}
                subtitle="Recovered vs amount at risk"
              />
            </section>

            {/* Recovery performance */}
            <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
                      Recovery performance
                    </h2>

                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Case-level recovery across the current
                      recovery batch.
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-3xl font-semibold text-zinc-950 dark:text-zinc-100">
                      {metrics.caseRecoveryRate}%
                    </p>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Case recovery rate
                    </p>
                  </div>
                </div>

                <div className="mt-8 h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-zinc-950 transition-all dark:bg-zinc-100"
                    style={{
                      width: `${Math.min(
                        metrics.amountRecoveryRate,
                        100
                      )}%`,
                    }}
                  />
                </div>

                <div className="mt-4 flex justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Recovered
                  </span>

                  <span className="font-medium text-zinc-950 dark:text-zinc-100">
                    {formatINR(
                      metrics.totalAmountRecovered
                    )}
                  </span>
                </div>

                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Remaining at risk
                  </span>

                  <span className="font-medium text-zinc-950 dark:text-zinc-100">
                    {formatINR(
                      Math.max(
                        metrics.totalAmountAtRisk -
                          metrics.totalAmountRecovered,
                        0
                      )
                    )}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Recovered cases
                </p>

                <div className="mt-4 text-4xl font-semibold text-zinc-950 dark:text-zinc-100">
                  {metrics.recoveredCases}
                </div>

                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  successfully recovered
                </p>

                <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Escalated
                    </span>

                    <span className="font-medium text-zinc-950 dark:text-zinc-100">
                      {metrics.escalatedCases}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      In progress
                    </span>

                    <span className="font-medium text-zinc-950 dark:text-zinc-100">
                      {metrics.inProgressCases}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Status */}
            <section className="mt-6">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
                  Recovery status
                </h2>

                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Current state of every recovery case.
                </p>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatusCard
                  label="Recovered"
                  value={metrics.recoveredCases}
                />

                <StatusCard
                  label="In Progress"
                  value={metrics.inProgressCases}
                />

                <StatusCard
                  label="Escalated"
                  value={metrics.escalatedCases}
                />

                <StatusCard
                  label="Failed"
                  value={metrics.failedCases}
                />

                <StatusCard
                  label="Open"
                  value={metrics.openCases}
                />
              </div>
            </section>

            {/* Policy / stopping */}
            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
                  Automated stopping
                </h2>

                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  Recovery automation stops when the configured
                  maximum payment-attempt threshold is reached.
                  The policy engine blocks additional automated
                  attempts.
                </p>

                <div className="mt-5 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      Maximum payment attempts
                    </span>

                    <span className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
                      3
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
                  Recovery coverage
                </h2>

                <div className="mt-5 space-y-4">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        Case recovery
                      </span>

                      <span className="font-medium text-zinc-950 dark:text-zinc-100">
                        {metrics.caseRecoveryRate}%
                      </span>
                    </div>

                    <div className="mt-2 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-2 rounded-full bg-zinc-950 dark:bg-zinc-100"
                        style={{
                          width: `${Math.min(
                            metrics.caseRecoveryRate,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        Money recovery
                      </span>

                      <span className="font-medium text-zinc-950 dark:text-zinc-100">
                        {metrics.amountRecoveryRate}%
                      </span>
                    </div>

                    <div className="mt-2 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-2 rounded-full bg-zinc-950 dark:bg-zinc-100"
                        style={{
                          width: `${Math.min(
                            metrics.amountRecoveryRate,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : null}

        {/* Recovery cases */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 p-6 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
              Recovery cases
            </h2>

            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Latest payment recovery activity.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-6 py-4 font-medium">
                    Customer
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Amount
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Payment
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Recovery
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Promise
                  </th>
                </tr>
              </thead>

              <tbody>
                {cases.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-10 text-center text-zinc-500 dark:text-zinc-400"
                    >
                      No recovery cases found.
                    </td>
                  </tr>
                ) : (
                  cases.map((recoveryCase) => (
                    <tr
                      key={recoveryCase.id}
                      className="cursor-pointer border-b border-zinc-100 transition-colors hover:bg-zinc-50 last:border-0 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
                      // onClick={() => {
                      //   window.location.href =
                      //     `/cases/${recoveryCase.id}`;
                      // }}
                      onClick={() => {
                          router.push(
                                `/cases/${recoveryCase.id}`
                                );
                           }}
                    >
                      {/* Customer */}
                      <td className="px-6 py-5">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {recoveryCase.customer?.name ??
                            "Unknown customer"}
                        </div>

                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {recoveryCase.customer?.phone ??
                            "No phone"}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-6 py-5">
                        <div className="font-medium text-zinc-950 dark:text-zinc-100">
                          {formatINR(
                            recoveryCase.amountAtRisk
                          )}
                        </div>

                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          recovered{" "}
                          {formatINR(
                            recoveryCase.amountRecovered
                          )}
                        </div>
                      </td>

                      {/* Payment */}
                      <td className="px-6 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                            recoveryCase.payment?.status ??
                              "UNKNOWN"
                          )}`}
                        >
                          {recoveryCase.payment?.status ??
                            "UNKNOWN"}
                        </span>
                      </td>

                      {/* Recovery */}
                      <td className="px-6 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                            recoveryCase.status
                          )}`}
                        >
                          {recoveryCase.status}
                        </span>
                      </td>

                      {/* Promise */}
                      <td className="px-6 py-5">
                        {recoveryCase.activePromise ? (
                          <div>
                            <div className="font-medium text-zinc-950 dark:text-zinc-100">
                              {recoveryCase.activePromise.source}
                            </div>

                            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {new Date(
                                recoveryCase.activePromise
                                  .promisedFor
                              ).toLocaleDateString(
                                "en-IN"
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}