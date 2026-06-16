import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Copy,
  Download,
  FileText,
  Instagram,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react';
import type {
  AdminClient,
  AdminClientStatus,
  AdminDietPlanRecord,
  AdminPaymentStatus,
} from '../types';
import {
  ADMIN_CLIENT_STATUSES,
  ADMIN_NEW_CLIENT_ROUTE_HASH,
  ADMIN_NOTICE_STORAGE_KEY,
  ADMIN_PAYMENT_STATUSES,
  ADMIN_SESSION_STORAGE_KEY,
  buildAdminClientEditRouteHash,
  buildAdminClientRouteHash,
  buildClientIntakeMessage,
  createAdminClient,
  createDietPlanFromAdminClient,
  createRenewedDietPlanFromRecord,
  deleteAdminClientAsync,
  deleteAdminDietPlanRecordAsync,
  getAdminDietPlanPdfSignedUrl,
  parseAdminClientRouteId,
  readAdminClientsAsync,
  readAdminDietPlanRecordsAsync,
  saveAdminClientAsync,
} from '../utils/adminPanel';
import {
  buildInstagramProfileUrl,
  buildWhatsAppDietPlanUrl,
  DIET_PLAN_STORAGE_KEY,
  formatDietPlanForInstagram,
  formatDietPlanForSharing,
} from '../utils/dietPlan';
import {
  DIET_PLAN_ACCESS_CODE,
  containsDietPlanAccessCode,
} from '../utils/dietPlanAccess';
import {
  getSupabaseSession,
  isSupabaseConfigured,
  supabase,
} from '../utils/supabaseClient';

type AdminNotice = {
  type: 'success' | 'error';
  message: string;
} | null;

type AdminPanelProps = {
  currentHash: string;
};

const inputClassName =
  'w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-leaf-500 focus:ring-2 focus:ring-leaf-100';

const labelClassName = 'mb-2 block text-sm font-semibold text-slate-700';

const primaryButtonClassName =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-leaf-600 px-4 text-sm font-semibold text-white transition hover:bg-leaf-700 disabled:cursor-not-allowed disabled:bg-slate-300';

const darkButtonClassName =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300';

const secondaryButtonClassName =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-leaf-300 hover:text-leaf-700 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300';

const dangerButtonClassName =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300';

const panelClassName =
  'rounded-lg border border-slate-200 bg-white p-6 shadow-sm';

const statusLabelMap = Object.fromEntries(
  ADMIN_CLIENT_STATUSES.map((status) => [status.id, status.label]),
) as Record<AdminClientStatus, string>;

const paymentLabelMap = Object.fromEntries(
  ADMIN_PAYMENT_STATUSES.map((status) => [status.id, status.label]),
) as Record<AdminPaymentStatus, string>;

const statusToneMap: Record<AdminClientStatus, string> = {
  new: 'bg-slate-100 text-slate-700',
  intakeReceived: 'bg-sky-50 text-sky-700',
  paymentPending: 'bg-amber-50 text-amber-700',
  planPending: 'bg-violet-50 text-violet-700',
  planSent: 'bg-leaf-50 text-leaf-700',
  followUpDue: 'bg-orange-50 text-orange-700',
  completed: 'bg-slate-900 text-white',
};

const paymentToneMap: Record<AdminPaymentStatus, string> = {
  unpaid: 'bg-red-50 text-red-700',
  partial: 'bg-amber-50 text-amber-700',
  paid: 'bg-leaf-50 text-leaf-700',
};
const GOAL_DROPDOWN_OPTIONS = [
  'Weight Loss Vegetarian',
  'Weight Gain Healthy Diet',
  'PCOS/PCOD Friendly',
  'Thyroid Friendly',
  'Gestational Diabetes',
  'Anemia Friendly',
  'Fatty Liver Friendly',
  'Hypertension Friendly (Low Sodium)',
  'Kidney Friendly',
  'Prediabetes Friendly',
  'High Cholesterol Friendly',
  'Gut Health Friendly',
] as const;

const formatDate = (value: string): string => {
  if (!value) {
    return 'Not set';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};

const formatRelativeDate = (value: string): string => {
  if (!value) {
    return 'No follow-up set';
  }

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return value;
  }

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  const dayDelta = Math.round(
    (startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000,
  );

  if (dayDelta === 0) {
    return 'Follow-up today';
  }

  if (dayDelta === 1) {
    return 'Follow-up tomorrow';
  }

  if (dayDelta === -1) {
    return 'Follow-up yesterday';
  }

  if (dayDelta > 1) {
    return `Follow-up in ${dayDelta} days`;
  }

  return `Follow-up ${Math.abs(dayDelta)} days overdue`;
};

const createFreshClient = (): AdminClient => createAdminClient();

const AdminPanel: React.FC<AdminPanelProps> = ({ currentHash }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    !isSupabaseConfigured &&
    window.sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) === 'unlocked',
  );
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [accessCode, setAccessCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [planRecords, setPlanRecords] = useState<AdminDietPlanRecord[]>([]);
  const [activeClientId, setActiveClientId] = useState('');
  const [draftClient, setDraftClient] = useState<AdminClient>(() =>
    createFreshClient(),
  );
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AdminClientStatus>(
    'all',
  );
  const [paymentFilter, setPaymentFilter] = useState<'all' | AdminPaymentStatus>(
    'all',
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [startingPlanClientId, setStartingPlanClientId] = useState('');
  const [renewingPlanId, setRenewingPlanId] = useState('');
  const [notice, setNotice] = useState<AdminNotice>(null);

  const routeClientId = useMemo(
    () => parseAdminClientRouteId(currentHash),
    [currentHash],
  );
  const isCreateClientRoute = currentHash === ADMIN_NEW_CLIENT_ROUTE_HASH;
  const isEditClientRoute = Boolean(routeClientId) && currentHash.endsWith('/edit');
  const isProfileFormRoute = isCreateClientRoute || isEditClientRoute;
  const isClientDetailRoute = Boolean(routeClientId) && !isEditClientRoute;
  const isDashboardRoute = !isProfileFormRoute && !isClientDetailRoute;

  const activeClient = useMemo(
    () =>
      clients.find((client) => client.id === (routeClientId || activeClientId)) ||
      null,
    [activeClientId, clients, routeClientId],
  );

  const filteredClients = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return clients.filter((client) => {
      const statusMatches =
        statusFilter === 'all' || client.status === statusFilter;
      const paymentMatches =
        paymentFilter === 'all' || client.paymentStatus === paymentFilter;
      const searchMatches =
        !normalizedSearch ||
        [
          client.name,
          client.phone,
          client.instagramHandle,
          client.goal,
          client.healthIssues,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);

      return statusMatches && paymentMatches && searchMatches;
    }).sort((first, second) => {
      const firstTime = new Date(first.updatedAt || first.createdAt).getTime();
      const secondTime = new Date(second.updatedAt || second.createdAt).getTime();

      return (Number.isNaN(secondTime) ? 0 : secondTime) -
        (Number.isNaN(firstTime) ? 0 : firstTime);
    });
  }, [clients, paymentFilter, searchText, statusFilter]);

  const selectedClientPlans = useMemo(
    () =>
      activeClient
        ? planRecords.filter((record) => record.clientId === activeClient.id)
        : planRecords.slice(0, 5),
    [activeClient, planRecords],
  );

  const dashboardSummary = useMemo(() => {
    const pendingPlans = clients.filter(
      (client) => client.status === 'planPending',
    ).length;
    const unpaidClients = clients.filter(
      (client) => client.paymentStatus !== 'paid',
    ).length;
    const followUps = clients.filter(
      (client) => client.followUpDate && client.status !== 'completed',
    ).length;

    return [
      { label: 'Visible', value: filteredClients.length.toString() },
      { label: 'Pending plans', value: pendingPlans.toString() },
      { label: 'Unpaid', value: unpaidClients.toString() },
      { label: 'Follow-ups set', value: followUps.toString() },
    ];
  }, [clients, filteredClients.length]);

  const clientCompletion = useMemo(() => {
    const requiredFields: Array<keyof AdminClient> = [
      'name',
      'age',
      'height',
      'weight',
      'dietType',
      'goal',
      'workoutStatus',
    ];
    const completedFields = requiredFields.filter((field) =>
      draftClient[field].trim(),
    ).length;

    return {
      completedFields,
      totalFields: requiredFields.length,
      percentage: Math.round((completedFields / requiredFields.length) * 100),
    };
  }, [draftClient]);

  const loadAdminData = async () => {
    const [nextClients, nextPlanRecords] = await Promise.all([
      readAdminClientsAsync(),
      readAdminDietPlanRecordsAsync(),
    ]);
    setClients(nextClients);
    setPlanRecords(nextPlanRecords);
  };

  useEffect(() => {
    const storedNotice = window.sessionStorage.getItem(ADMIN_NOTICE_STORAGE_KEY);

    if (!storedNotice) {
      return;
    }

    window.sessionStorage.removeItem(ADMIN_NOTICE_STORAGE_KEY);

    try {
      const parsedNotice = JSON.parse(storedNotice) as {
        type?: unknown;
        message?: unknown;
      };

      if (
        (parsedNotice.type === 'success' || parsedNotice.type === 'error') &&
        typeof parsedNotice.message === 'string'
      ) {
        setNotice({
          type: parsedNotice.type,
          message: parsedNotice.message,
        });
      }
    } catch {
      setNotice(null);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initializeAdmin = async () => {
      try {
        if (isSupabaseConfigured) {
          const session = await getSupabaseSession();
          if (!isMounted) {
            return;
          }

          setIsAuthenticated(Boolean(session));

          if (session) {
            await loadAdminData();
          }
          return;
        }

        const unlocked =
          window.sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) ===
          'unlocked';
        if (!isMounted) {
          return;
        }
        setIsAuthenticated(unlocked);

        if (unlocked) {
          await loadAdminData();
        }
      } catch (error) {
        if (isMounted) {
          setNotice({
            type: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Could not load admin data.',
          });
        }
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    };

    initializeAdmin();

    if (!supabase) {
      return () => {
        isMounted = false;
      };
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
      if (session) {
        loadAdminData().catch((error: unknown) => {
          setNotice({
            type: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Could not load admin data.',
          });
        });
      } else {
        setClients([]);
        setPlanRecords([]);
      }
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!routeClientId) {
      return;
    }

    const routedClient = clients.find((client) => client.id === routeClientId);

    if (routedClient) {
      setActiveClientId(routedClient.id);
      setDraftClient(routedClient);
    }
  }, [clients, routeClientId]);

  useEffect(() => {
    if (!isCreateClientRoute) {
      return;
    }

    setActiveClientId('');
    setDraftClient(createFreshClient());
  }, [isCreateClientRoute]);

  const refreshData = async () => {
    try {
      setIsRefreshing(true);
      await loadAdminData();
      setNotice({ type: 'success', message: 'Admin data refreshed.' });
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Could not refresh data.',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const updateDraftField = (field: keyof AdminClient, value: string) => {
    setDraftClient((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateDraftStatus = (value: AdminClientStatus) => {
    setDraftClient((current) => ({
      ...current,
      status: value,
    }));
  };

  const updateDraftPaymentStatus = (value: AdminPaymentStatus) => {
    setDraftClient((current) => ({
      ...current,
      paymentStatus: value,
    }));
  };

  const selectClient = (client: AdminClient) => {
    setActiveClientId(client.id);
    setDraftClient(client);
    window.location.hash = buildAdminClientRouteHash(client.id);
  };

  const startNewClient = () => {
    setActiveClientId('');
    setDraftClient(createFreshClient());
    setNotice(null);
    window.location.hash = ADMIN_NEW_CLIENT_ROUTE_HASH;
  };

  const saveClient = async () => {
    if (!draftClient.name.trim()) {
      setNotice({ type: 'error', message: 'Add client name before saving.' });
      return;
    }

    try {
      setIsSavingClient(true);
      const clientToSave = await saveAdminClientAsync(draftClient);
      await loadAdminData();
      setActiveClientId(clientToSave.id);
      setDraftClient(clientToSave);
      setNotice({ type: 'success', message: 'Client saved.' });
      window.location.hash = buildAdminClientRouteHash(clientToSave.id);
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Could not save client.',
      });
    } finally {
      setIsSavingClient(false);
    }
  };

  const copyIntakeQuestions = async () => {
    try {
      await navigator.clipboard.writeText(buildClientIntakeMessage(draftClient));
      setNotice({ type: 'success', message: 'Intake questions copied.' });
    } catch {
      setNotice({
        type: 'error',
        message: 'Copy failed. Select and copy the questions manually.',
      });
    }
  };

  const startDietPlan = async (client: AdminClient) => {
    const now = new Date().toISOString();
    const savedClient: AdminClient = {
      ...client,
      status: 'planPending',
      createdAt: client.createdAt || now,
      updatedAt: now,
    };

    try {
      setStartingPlanClientId(client.id);
      const persistedClient = await saveAdminClientAsync(savedClient);
      const plan = createDietPlanFromAdminClient(persistedClient);
      setActiveClientId(persistedClient.id);
      setDraftClient(persistedClient);
      window.localStorage.setItem(DIET_PLAN_STORAGE_KEY, JSON.stringify(plan));
      window.location.hash = '#/diet-plan';
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Could not create plan.',
      });
    } finally {
      setStartingPlanClientId('');
    }
  };

  const openPlanRecord = (record: AdminDietPlanRecord) => {
    window.localStorage.setItem(
      DIET_PLAN_STORAGE_KEY,
      JSON.stringify(record.plan),
    );
    window.location.hash = '#/diet-plan';
  };

  const renewPlanRecord = async (record: AdminDietPlanRecord) => {
    const sourceClient =
      activeClient || clients.find((client) => client.id === record.clientId) ||
      null;
    const confirmed = window.confirm(
      `Create a new editable copy of "${record.title}"? The old plan and stored PDF will remain unchanged.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setRenewingPlanId(record.id);

      if (sourceClient) {
        const now = new Date().toISOString();
        const nextClient = await saveAdminClientAsync({
          ...sourceClient,
          status: 'planPending',
          updatedAt: now,
        });
        setClients((currentClients) =>
          currentClients.map((client) =>
            client.id === nextClient.id ? nextClient : client,
          ),
        );
        setActiveClientId(nextClient.id);
        setDraftClient(nextClient);
        window.localStorage.setItem(
          DIET_PLAN_STORAGE_KEY,
          JSON.stringify(createRenewedDietPlanFromRecord(record, nextClient)),
        );
      } else {
        window.localStorage.setItem(
          DIET_PLAN_STORAGE_KEY,
          JSON.stringify(createRenewedDietPlanFromRecord(record)),
        );
      }

      window.location.hash = '#/diet-plan';
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Could not renew diet plan.',
      });
    } finally {
      setRenewingPlanId('');
    }
  };

  const deletePlanRecord = async (record: AdminDietPlanRecord) => {
    const confirmed = window.confirm(
      `Delete "${record.title}" for ${record.patientName}? This will also remove the stored PDF.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteAdminDietPlanRecordAsync(record);
      await loadAdminData();
      setNotice({ type: 'success', message: 'Diet plan deleted.' });
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Could not delete diet plan.',
      });
    }
  };

  const deleteClient = async () => {
    if (!activeClient) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${activeClient.name || 'this client'} and all saved diet plans?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteAdminClientAsync(activeClient.id);
      await loadAdminData();
      setActiveClientId('');
      setDraftClient(createFreshClient());
      window.location.hash = '#/admin';
      setNotice({ type: 'success', message: 'Client and diet plans deleted.' });
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Could not delete client.',
      });
    }
  };

  const downloadStoredPdf = async (record: AdminDietPlanRecord) => {
    try {
      const signedUrl = await getAdminDietPlanPdfSignedUrl(record);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Could not open stored PDF.',
      });
    }
  };

  const copyPlanRecord = async (record: AdminDietPlanRecord) => {
    try {
      await navigator.clipboard.writeText(formatDietPlanForSharing(record.plan));
      setNotice({
        type: 'success',
        message: `"${record.title}" copied for sharing.`,
      });
    } catch {
      setNotice({
        type: 'error',
        message: 'Copy failed. Open the plan and copy manually.',
      });
    }
  };

  const sendPlanRecordToWhatsApp = (record: AdminDietPlanRecord) => {
    if (!record.plan.patient.phone.trim()) {
      setNotice({
        type: 'error',
        message: 'Add a WhatsApp number to this client before sending.',
      });
      return;
    }

    window.open(
      buildWhatsAppDietPlanUrl(record.plan),
      '_blank',
      'noopener,noreferrer',
    );
  };

  const sharePlanRecordOnInstagram = async (record: AdminDietPlanRecord) => {
    try {
      await navigator.clipboard.writeText(formatDietPlanForInstagram(record.plan));
      const instagramHandle = record.plan.patient.instagramHandle.trim();

      if (instagramHandle) {
        window.open(
          buildInstagramProfileUrl(instagramHandle),
          '_blank',
          'noopener,noreferrer',
        );
      }

      setNotice({
        type: 'success',
        message: instagramHandle
          ? 'Instagram message copied and profile opened.'
          : 'Instagram message copied. No handle is saved for this client.',
      });
    } catch {
      setNotice({
        type: 'error',
        message: 'Instagram copy failed. Open the plan and copy manually.',
      });
    }
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSupabaseConfigured) {
      if (!supabase) {
        setNotice({ type: 'error', message: 'Supabase is not configured.' });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setNotice({ type: 'error', message: error.message });
        return;
      }

      setNotice({ type: 'success', message: 'Admin signed in.' });
      return;
    }

    if (containsDietPlanAccessCode(accessCode)) {
      window.sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, 'unlocked');
      setIsAuthenticated(true);
      await loadAdminData();
      setNotice({ type: 'success', message: 'Admin unlocked.' });
      return;
    }

    setNotice({ type: 'error', message: 'Wrong admin code.' });
  };

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    window.sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    setIsAuthenticated(false);
    setAccessCode('');
    setEmail('');
    setPassword('');
    setNotice(null);
  };

  if (isCheckingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 pt-24 text-slate-900">
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-leaf-600"></div>
          <p className="text-sm font-semibold text-slate-600">
            Checking admin session...
          </p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 pt-28 text-slate-900">
        <section className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-leaf-600 text-white">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">
                Admin Panel
              </h1>
              <p className="text-sm text-slate-500">
                {isSupabaseConfigured
                  ? 'Sign in with your Supabase admin account.'
                  : 'Enter the private code to manage clients.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {isSupabaseConfigured ? (
              <>
                <label>
                  <span className={labelClassName}>Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClassName}
                    placeholder="admin@example.com"
                  />
                </label>
                <label>
                  <span className={labelClassName}>Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={inputClassName}
                    placeholder="Admin password"
                  />
                </label>
              </>
            ) : (
              <label>
                <span className={labelClassName}>Admin Code</span>
                <input
                  type="password"
                  value={accessCode}
                  onChange={(event) => setAccessCode(event.target.value)}
                  className={inputClassName}
                  placeholder={DIET_PLAN_ACCESS_CODE}
                />
              </label>
            )}
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-leaf-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-leaf-700"
            >
              <ShieldCheck size={18} />
              Unlock Admin
            </button>
          </form>

          {notice && (
            <p
              className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${
                notice.type === 'success'
                  ? 'border-leaf-200 bg-leaf-50 text-leaf-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {notice.message}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pt-24 text-slate-900">
      <section className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-6 py-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                <span className="rounded-full bg-leaf-50 px-3 py-1 text-leaf-700">
                  Private Admin
                </span>
                <span>
                  {isDashboardRoute
                    ? 'Client Pipeline'
                    : isProfileFormRoute
                      ? 'Client Intake'
                      : 'Client Workspace'}
                </span>
              </div>
              <h1 className="font-serif text-4xl font-bold text-slate-950 md:text-5xl">
                {isCreateClientRoute
                  ? 'Create Client'
                  : isEditClientRoute
                    ? `Edit ${activeClient?.name || 'Client'}`
                    : isClientDetailRoute
                  ? activeClient?.name || 'Client Details'
                  : 'Clients'}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">
                {isProfileFormRoute
                  ? 'Capture the intake once, save the profile, then create a diet plan from the same client record.'
                  : isClientDetailRoute
                  ? 'Review intake details, create a new diet plan, and manage every saved PDF for this client.'
                  : 'Find the right client fast, check status at a glance, and continue the next action from their card.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              {(isClientDetailRoute || isProfileFormRoute) && (
                <button
                  type="button"
                  onClick={() => {
                    window.location.hash = '#/admin';
                  }}
                  className={secondaryButtonClassName}
                >
                  <ArrowLeft size={18} />
                  Dashboard
                </button>
              )}
              <button
                type="button"
                onClick={refreshData}
                disabled={isRefreshing}
                className={secondaryButtonClassName}
              >
                {isRefreshing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <RefreshCcw size={18} />
                )}
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={startNewClient}
                disabled={isCreateClientRoute}
                className={primaryButtonClassName}
              >
                <Plus size={18} />
                New Client
              </button>
              <button
                type="button"
                onClick={logout}
                className={darkButtonClassName}
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>

          {notice && (
            <div
              className={`mt-6 rounded-lg border px-4 py-3 text-sm font-medium ${
                notice.type === 'success'
                  ? 'border-leaf-200 bg-leaf-50 text-leaf-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {notice.message}
            </div>
          )}
        </div>
      </section>

      <section className="container mx-auto px-6 py-8">
        <div
          className={
            isProfileFormRoute
              ? 'mx-auto max-w-5xl'
              : isClientDetailRoute
                ? 'grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]'
                : 'space-y-6'
          }
        >
          {isDashboardRoute && (
          <section className={panelClassName}>
            <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-leaf-50 text-leaf-700">
                  <UsersRound size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Client Cards
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    Select a client to open their profile, plan history, and diet plan actions.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {dashboardSummary.map((item) => (
                      <span
                        key={item.label}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
                      >
                        {item.label}: {item.value}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[720px]">
                <div className="relative">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    className={`${inputClassName} pl-10`}
                    placeholder="Search clients"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as 'all' | AdminClientStatus)
                  }
                  className={inputClassName}
                >
                  <option value="all">All statuses</option>
                  {ADMIN_CLIENT_STATUSES.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.label}
                    </option>
                  ))}
                </select>
                <select
                  value={paymentFilter}
                  onChange={(event) =>
                    setPaymentFilter(event.target.value as 'all' | AdminPaymentStatus)
                  }
                  className={inputClassName}
                >
                  <option value="all">All payments</option>
                  {ADMIN_PAYMENT_STATUSES.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredClients.length ? (
                filteredClients.map((client) => (
                  <article
                    key={client.id}
                    className="flex min-h-60 flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-leaf-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-bold text-slate-900">
                          {client.name || 'Unnamed client'}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {client.goal || 'No goal added'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                          statusToneMap[client.status]
                        }`}
                      >
                        {statusLabelMap[client.status]}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 text-sm">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                          Contact
                        </p>
                        <p className="mt-1 font-semibold text-slate-700">
                          {client.phone ||
                            client.instagramHandle ||
                            client.email ||
                            'No contact'}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                            Payment
                          </p>
                          <span
                            className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-bold ${
                              paymentToneMap[client.paymentStatus]
                            }`}
                          >
                            {paymentLabelMap[client.paymentStatus]}
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                            Follow-up
                          </p>
                          <p className="mt-1 inline-flex items-center gap-1.5 font-semibold text-slate-700">
                            <CalendarDays size={14} className="text-leaf-700" />
                            {formatRelativeDate(client.followUpDate)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-wrap gap-2 pt-5">
                      <button
                        type="button"
                        onClick={() => selectClient(client)}
                        className={secondaryButtonClassName}
                      >
                        <UserRound size={16} />
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => startDietPlan(client)}
                        disabled={startingPlanClientId === client.id}
                        className={primaryButtonClassName}
                      >
                        {startingPlanClientId === client.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Sparkles size={16} />
                        )}
                        Plan
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                  No clients found.
                </div>
              )}
            </div>
          </section>
          )}

          {isClientDetailRoute && (
          <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start">
              <div className={panelClassName}>
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-leaf-50 text-leaf-700">
                    <UserRound size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Client Summary
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Intake snapshot and next best action.
                    </p>
                  </div>
                </div>
                {activeClient ? (
                  <div className="space-y-5">
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          statusToneMap[activeClient.status]
                        }`}
                      >
                        {statusLabelMap[activeClient.status]}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          paymentToneMap[activeClient.paymentStatus]
                        }`}
                      >
                        {paymentLabelMap[activeClient.paymentStatus]}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-slate-50 p-4">
                        <p className="font-semibold text-slate-500">Plans</p>
                        <p className="mt-1 text-2xl font-bold text-slate-950">
                          {selectedClientPlans.length}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4">
                        <p className="font-semibold text-slate-500">
                          Follow-up
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-950">
                          {formatRelativeDate(activeClient.followUpDate)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-lg border border-slate-100 p-4 text-sm">
                      {[
                        ['Contact', activeClient.phone || activeClient.instagramHandle || activeClient.email || 'Not added'],
                        ['Goal', activeClient.goal || 'Not added'],
                        ['Health', activeClient.healthIssues || 'Not added'],
                        ['Diet', activeClient.dietType || 'Not added'],
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-4">
                          <span className="font-semibold text-slate-500">
                            {label}
                          </span>
                          <span className="text-right font-semibold text-slate-800">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-2">
                      <button
                        type="button"
                        onClick={() => startDietPlan(activeClient)}
                        disabled={startingPlanClientId === activeClient.id}
                        className={primaryButtonClassName}
                      >
                        {startingPlanClientId === activeClient.id ? (
                          <Loader2 size={17} className="animate-spin" />
                        ) : (
                          <Sparkles size={17} />
                        )}
                        {startingPlanClientId === activeClient.id
                          ? 'Opening Planner...'
                          : 'Create Diet Plan'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          window.location.hash = buildAdminClientEditRouteHash(
                            activeClient.id,
                          );
                        }}
                        className={secondaryButtonClassName}
                      >
                        <Pencil size={17} />
                        Edit Profile
                      </button>
                      <button
                        type="button"
                        onClick={deleteClient}
                        className={dangerButtonClassName}
                      >
                        <Trash2 size={17} />
                        Delete Client
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                    This client was not found. Go back to the dashboard and
                    select an existing client.
                  </div>
                )}
              </div>
          </aside>
          )}

          <div className="space-y-6">
            {isProfileFormRoute && (
            <section className={panelClassName}>
              <div className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-leaf-50 text-leaf-700">
                    <UserRound size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {isCreateClientRoute ? 'New Client Intake' : 'Edit Client Intake'}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                      Add the essential details first. The diet planner will reuse these fields for AI meal generation and PDF records.
                    </p>
                    <div className="mt-4 max-w-md">
                      <div className="mb-2 flex justify-between text-xs font-bold text-slate-500">
                        <span>Required intake completeness</span>
                        <span>
                          {clientCompletion.completedFields}/{clientCompletion.totalFields}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-leaf-600 transition-all"
                          style={{ width: `${clientCompletion.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-leaf-100 bg-leaf-50 p-4">
                  <p className="text-sm font-bold text-slate-900">
                    Recommended flow
                  </p>
                  <ol className="mt-3 space-y-2 text-sm font-semibold text-slate-600">
                    <li>1. Save client profile</li>
                    <li>2. Create diet plan from saved client</li>
                    <li>3. Save final PDF to plan history</li>
                  </ol>
                  <div className="mt-4 grid gap-2">
                    <button
                      type="button"
                      onClick={saveClient}
                      disabled={isSavingClient}
                      className={primaryButtonClassName}
                    >
                      {isSavingClient ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <Save size={17} />
                      )}
                      {isSavingClient ? 'Saving Client...' : 'Save Client'}
                    </button>
                    <button
                      type="button"
                      onClick={() => startDietPlan(draftClient)}
                      disabled={!draftClient.name.trim() || Boolean(startingPlanClientId)}
                      className={darkButtonClassName}
                    >
                      {startingPlanClientId ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <Sparkles size={17} />
                      )}
                      Create Plan
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={copyIntakeQuestions}
                  className={secondaryButtonClassName}
                >
                  <Copy size={17} />
                  Copy Intake Questions
                </button>
              </div>

              <div className="mb-5 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-sm font-bold text-slate-800">
                  Client profile
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Contact, body metrics, medical context, preferences, and workflow status.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label>
                  <span className={labelClassName}>Name</span>
                  <input
                    value={draftClient.name}
                    onChange={(event) =>
                      updateDraftField('name', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="Client full name"
                  />
                </label>
                <label>
                  <span className={labelClassName}>Phone</span>
                  <input
                    value={draftClient.phone}
                    onChange={(event) =>
                      updateDraftField('phone', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="+91 98765 43210"
                  />
                </label>
                <label>
                  <span className={labelClassName}>Instagram</span>
                  <input
                    value={draftClient.instagramHandle}
                    onChange={(event) =>
                      updateDraftField('instagramHandle', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="@username"
                  />
                </label>
                <label>
                  <span className={labelClassName}>Email</span>
                  <input
                    value={draftClient.email}
                    onChange={(event) =>
                      updateDraftField('email', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="Optional"
                  />
                </label>
                <label>
                  <span className={labelClassName}>Age</span>
                  <input
                    value={draftClient.age}
                    onChange={(event) =>
                      updateDraftField('age', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="29"
                  />
                </label>
                <label>
                  <span className={labelClassName}>Gender</span>
                  <input
                    value={draftClient.gender}
                    onChange={(event) =>
                      updateDraftField('gender', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="Female"
                  />
                </label>
                <label>
                  <span className={labelClassName}>Height</span>
                  <input
                    value={draftClient.height}
                    onChange={(event) =>
                      updateDraftField('height', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="162 cm"
                  />
                </label>
                <label>
                  <span className={labelClassName}>Weight</span>
                  <input
                    value={draftClient.weight}
                    onChange={(event) =>
                      updateDraftField('weight', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="59 kg"
                  />
                </label>
                <label>
                  <span className={labelClassName}>Diet Type</span>
                  <select
                    value={draftClient.dietType}
                    onChange={(event) =>
                      updateDraftField('dietType', event.target.value)
                    }
                    className={inputClassName}
                  >
                    <option value="">Select</option>
                    <option value="Veg">Veg</option>
                    <option value="Eggetarian">Eggetarian</option>
                    <option value="Non-veg">Non-veg</option>
                  </select>
                </label>
                <label>
                  <span className={labelClassName}>Goal</span>
                  <input
                    value={draftClient.goal}
                    onChange={(event) =>
                      updateDraftField('goal', event.target.value)
                    }
                    className={inputClassName}
                    list="admin-goal-options"
                    placeholder="Select a goal"
                  />
                  <datalist id="admin-goal-options">
                    {GOAL_DROPDOWN_OPTIONS.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </label>
                <label>
                  <span className={labelClassName}>Workout</span>
                  <select
                    value={draftClient.workoutStatus}
                    onChange={(event) =>
                      updateDraftField('workoutStatus', event.target.value)
                    }
                    className={inputClassName}
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </label>
                <label>
                  <span className={labelClassName}>Workout Type</span>
                  <input
                    value={draftClient.workoutType}
                    onChange={(event) =>
                      updateDraftField('workoutType', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="Walking, gym, yoga"
                  />
                </label>
                <label>
                  <span className={labelClassName}>Client Status</span>
                  <select
                    value={draftClient.status}
                    onChange={(event) =>
                      updateDraftStatus(event.target.value as AdminClientStatus)
                    }
                    className={inputClassName}
                  >
                    {ADMIN_CLIENT_STATUSES.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={labelClassName}>Payment Status</span>
                  <select
                    value={draftClient.paymentStatus}
                    onChange={(event) =>
                      updateDraftPaymentStatus(
                        event.target.value as AdminPaymentStatus,
                      )
                    }
                    className={inputClassName}
                  >
                    {ADMIN_PAYMENT_STATUSES.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={labelClassName}>Package</span>
                  <input
                    value={draftClient.packageName}
                    onChange={(event) =>
                      updateDraftField('packageName', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="1 week, 1 month, 3 months"
                  />
                </label>
                <label>
                  <span className={labelClassName}>Amount</span>
                  <input
                    value={draftClient.amount}
                    onChange={(event) =>
                      updateDraftField('amount', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="INR"
                  />
                </label>
                <label>
                  <span className={labelClassName}>Follow-up Date</span>
                  <input
                    type="date"
                    value={draftClient.followUpDate}
                    onChange={(event) =>
                      updateDraftField('followUpDate', event.target.value)
                    }
                    className={inputClassName}
                  />
                </label>
                <label>
                  <span className={labelClassName}>Wake / Sleep Time</span>
                  <input
                    value={draftClient.wakeSleepTime}
                    onChange={(event) =>
                      updateDraftField('wakeSleepTime', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="7 AM wake, 11 PM sleep"
                  />
                </label>
                <label className="md:col-span-2">
                  <span className={labelClassName}>Allergies</span>
                  <textarea
                    rows={2}
                    value={draftClient.allergies}
                    onChange={(event) =>
                      updateDraftField('allergies', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="Food allergies or intolerances"
                  />
                </label>
                <label className="md:col-span-2">
                  <span className={labelClassName}>Health Issues</span>
                  <textarea
                    rows={2}
                    value={draftClient.healthIssues}
                    onChange={(event) =>
                      updateDraftField('healthIssues', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="PCOS, thyroid, diabetes, acidity, etc."
                  />
                </label>
                <label className="md:col-span-2">
                  <span className={labelClassName}>Medicines / Supplements</span>
                  <textarea
                    rows={2}
                    value={draftClient.medicinesSupplements}
                    onChange={(event) =>
                      updateDraftField(
                        'medicinesSupplements',
                        event.target.value,
                      )
                    }
                    className={inputClassName}
                    placeholder="Medicine names, supplement timing"
                  />
                </label>
                <label>
                  <span className={labelClassName}>Cuisine Preference</span>
                  <input
                    value={draftClient.cuisinePreference}
                    onChange={(event) =>
                      updateDraftField('cuisinePreference', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="Indian home-style, South Indian"
                  />
                </label>
                <label>
                  <span className={labelClassName}>Budget Preference</span>
                  <input
                    value={draftClient.budgetPreference}
                    onChange={(event) =>
                      updateDraftField('budgetPreference', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="Low, medium, flexible"
                  />
                </label>
                <label className="md:col-span-2">
                  <span className={labelClassName}>Food Notes</span>
                  <textarea
                    rows={3}
                    value={draftClient.preferences}
                    onChange={(event) =>
                      updateDraftField('preferences', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="Likes, dislikes, restrictions, food habits"
                  />
                </label>
                <label className="md:col-span-2">
                  <span className={labelClassName}>Current Eating Pattern</span>
                  <textarea
                    rows={3}
                    value={draftClient.currentEatingPattern}
                    onChange={(event) =>
                      updateDraftField(
                        'currentEatingPattern',
                        event.target.value,
                      )
                    }
                    className={inputClassName}
                    placeholder="Morning to night current routine"
                  />
                </label>
                <label className="md:col-span-2">
                  <span className={labelClassName}>Internal Notes</span>
                  <textarea
                    rows={3}
                    value={draftClient.notes}
                    onChange={(event) =>
                      updateDraftField('notes', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="Payment notes, follow-up comments, admin reminders"
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-slate-600">
                  Save the client before creating the final diet plan workflow.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveClient}
                    disabled={isSavingClient}
                    className={primaryButtonClassName}
                  >
                    {isSavingClient ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Save size={17} />
                    )}
                    {isSavingClient ? 'Saving Client...' : 'Save Client'}
                  </button>
                  <button
                    type="button"
                    onClick={() => startDietPlan(draftClient)}
                    disabled={!draftClient.name.trim() || Boolean(startingPlanClientId)}
                    className={darkButtonClassName}
                  >
                    {startingPlanClientId ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Sparkles size={17} />
                    )}
                    Create Plan
                  </button>
                </div>
              </div>
            </section>
            )}

            {isClientDetailRoute && (
            <section className={panelClassName}>
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-leaf-50 text-leaf-700">
                    <FileText size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Plan History
                    </h2>
                    <p className="text-sm text-slate-500">
                      Saved diet plans and PDFs for this client stay here.
                    </p>
                  </div>
                </div>
                {activeClient && (
                  <button
                    type="button"
                    onClick={() => startDietPlan(activeClient)}
                    disabled={startingPlanClientId === activeClient.id}
                    className={primaryButtonClassName}
                  >
                    {startingPlanClientId === activeClient.id ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Sparkles size={17} />
                    )}
                    New Diet Plan
                  </button>
                )}
              </div>

              <div className="grid gap-3">
                {selectedClientPlans.length ? (
                  selectedClientPlans.map((record) => (
                    <div
                      key={record.id}
                      className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div>
                        <p className="text-lg font-bold text-slate-900">
                          {record.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {record.patientName} - {record.goal || 'No goal'} -
                          {' '}
                          {formatDate(record.updatedAt)}
                        </p>
                        <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                          {record.status}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2 sm:items-end">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openPlanRecord(record)}
                            className={secondaryButtonClassName}
                          >
                            <ClipboardList size={17} />
                            Edit Plan
                          </button>
                          <button
                            type="button"
                            onClick={() => renewPlanRecord(record)}
                            disabled={renewingPlanId === record.id}
                            className={primaryButtonClassName}
                            title="Create a new editable copy while keeping the old PDF unchanged"
                          >
                            {renewingPlanId === record.id ? (
                              <Loader2 size={17} className="animate-spin" />
                            ) : (
                              <RefreshCcw size={17} />
                            )}
                            Renew
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadStoredPdf(record)}
                            disabled={!record.pdfPath}
                            className={secondaryButtonClassName}
                            title={
                              record.pdfPath
                                ? 'Open stored customer PDF'
                                : 'Save Diet Plan from the diet plan editor to store PDF'
                            }
                          >
                            <Download size={17} />
                            PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePlanRecord(record)}
                            className={dangerButtonClassName}
                          >
                            <Trash2 size={17} />
                            Delete
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => copyPlanRecord(record)}
                            className={secondaryButtonClassName}
                          >
                            <Copy size={17} />
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => sendPlanRecordToWhatsApp(record)}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-leaf-200 bg-leaf-50 px-4 text-sm font-semibold text-leaf-800 transition hover:border-leaf-300"
                          >
                            <Send size={17} />
                            WhatsApp
                          </button>
                          <button
                            type="button"
                            onClick={() => sharePlanRecordOnInstagram(record)}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-pink-200 bg-pink-50 px-4 text-sm font-semibold text-pink-700 transition hover:border-pink-300"
                          >
                            <Instagram size={17} />
                            Instagram
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    No saved plans yet.
                  </div>
                )}
              </div>
            </section>
            )}

          </div>
        </div>
      </section>
    </main>
  );
};

export default AdminPanel;
