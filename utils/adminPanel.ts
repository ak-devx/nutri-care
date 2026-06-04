import type {
  AdminClient,
  AdminClientStatus,
  AdminDietPlanRecord,
  AdminPaymentStatus,
  DietPlan,
} from '../types';
import { createEmptyDietPlan, normalizeDietPlan } from './dietPlan.ts';
import { isSupabaseConfigured, supabase } from './supabaseClient.ts';

export const ADMIN_SESSION_STORAGE_KEY = 'nutriguide:admin-session';
export const ADMIN_NOTICE_STORAGE_KEY = 'nutriguide:admin-notice';
export const ADMIN_CLIENTS_STORAGE_KEY = 'nutriguide:admin-clients';
export const ADMIN_PLAN_RECORDS_STORAGE_KEY = 'nutriguide:admin-plan-records';
export const DIET_PLAN_PDF_BUCKET = 'diet-plan-pdfs';
export const ADMIN_PANEL_ROUTE_HASH = '#/admin';
export const ADMIN_NEW_CLIENT_ROUTE_HASH = '#/admin/clients/new';

export const ADMIN_CLIENT_STATUSES: Array<{
  id: AdminClientStatus;
  label: string;
}> = [
  { id: 'new', label: 'New Lead' },
  { id: 'intakeReceived', label: 'Intake Received' },
  { id: 'paymentPending', label: 'Payment Pending' },
  { id: 'planPending', label: 'Plan Pending' },
  { id: 'planSent', label: 'Plan Sent' },
  { id: 'followUpDue', label: 'Follow-up Due' },
  { id: 'completed', label: 'Completed' },
];

export const ADMIN_PAYMENT_STATUSES: Array<{
  id: AdminPaymentStatus;
  label: string;
}> = [
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'partial', label: 'Partial' },
  { id: 'paid', label: 'Paid' },
];

const ADMIN_CLIENT_STATUS_IDS = new Set<AdminClientStatus>(
  ADMIN_CLIENT_STATUSES.map((status) => status.id),
);

const ADMIN_PAYMENT_STATUS_IDS = new Set<AdminPaymentStatus>(
  ADMIN_PAYMENT_STATUSES.map((status) => status.id),
);

const getText = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const getClientStatus = (value: unknown): AdminClientStatus =>
  typeof value === 'string' &&
  ADMIN_CLIENT_STATUS_IDS.has(value as AdminClientStatus)
    ? (value as AdminClientStatus)
    : 'new';

const getPaymentStatus = (value: unknown): AdminPaymentStatus =>
  typeof value === 'string' &&
  ADMIN_PAYMENT_STATUS_IDS.has(value as AdminPaymentStatus)
    ? (value as AdminPaymentStatus)
    : 'unpaid';

const getObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

export const buildAdminClientRouteHash = (clientId: string): string =>
  `${ADMIN_PANEL_ROUTE_HASH}/clients/${encodeURIComponent(clientId)}`;

export const buildAdminClientEditRouteHash = (clientId: string): string =>
  `${buildAdminClientRouteHash(clientId)}/edit`;

export const parseAdminClientRouteId = (hash: string): string => {
  const routePrefix = `${ADMIN_PANEL_ROUTE_HASH}/clients/`;

  if (!hash.startsWith(routePrefix) || hash === ADMIN_NEW_CLIENT_ROUTE_HASH) {
    return '';
  }

  const rawClientId = hash.slice(routePrefix.length).split(/[?#]/)[0];
  const clientId = rawClientId.endsWith('/edit')
    ? rawClientId.slice(0, -'/edit'.length)
    : rawClientId;

  try {
    return decodeURIComponent(clientId);
  } catch {
    return clientId;
  }
};

type ClientRow = {
  id: string;
  owner_id: string;
  name: string;
  phone: string;
  instagram_handle: string;
  email: string;
  age: string;
  gender: string;
  height: string;
  weight: string;
  diet_type: string;
  allergies: string;
  health_issues: string;
  goal: string;
  workout_status: string;
  workout_type: string;
  medicines_supplements: string;
  preferences: string;
  wake_sleep_time: string;
  cuisine_preference: string;
  budget_preference: string;
  current_eating_pattern: string;
  package_name: string;
  amount: number | null;
  payment_status: AdminPaymentStatus;
  status: AdminClientStatus;
  follow_up_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

type DietPlanRow = {
  id: string;
  owner_id: string;
  client_id: string | null;
  title: string;
  goal: string;
  status: 'draft' | 'final';
  plan_json: unknown;
  pdf_path: string | null;
  created_at: string;
  updated_at: string;
};

const createId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}`;
};

const parseAmount = (value: string): number | null => {
  const normalized = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(normalized) ? normalized : null;
};

const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
};

const getAuthenticatedUserId = async (): Promise<string> => {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error('Please sign in again.');
  }

  return data.user.id;
};

export const createAdminClient = (
  client: Partial<AdminClient> = {},
): AdminClient => {
  const now = new Date().toISOString();

  return {
    id: client.id || createId('client'),
    name: client.name || '',
    phone: client.phone || '',
    instagramHandle: client.instagramHandle || '',
    email: client.email || '',
    age: client.age || '',
    gender: client.gender || '',
    height: client.height || '',
    weight: client.weight || '',
    dietType: client.dietType || '',
    allergies: client.allergies || '',
    healthIssues: client.healthIssues || '',
    goal: client.goal || '',
    workoutStatus: client.workoutStatus || '',
    workoutType: client.workoutType || '',
    medicinesSupplements: client.medicinesSupplements || '',
    preferences: client.preferences || '',
    wakeSleepTime: client.wakeSleepTime || '',
    cuisinePreference: client.cuisinePreference || '',
    budgetPreference: client.budgetPreference || '',
    currentEatingPattern: client.currentEatingPattern || '',
    packageName: client.packageName || '',
    amount: client.amount || '',
    paymentStatus: client.paymentStatus || 'unpaid',
    status: client.status || 'new',
    followUpDate: client.followUpDate || '',
    notes: client.notes || '',
    createdAt: client.createdAt || now,
    updatedAt: client.updatedAt || now,
  };
};

export const normalizeAdminClient = (value: unknown): AdminClient => {
  const item = getObject(value);
  const now = new Date().toISOString();

  return createAdminClient({
    id: getText(item.id) || `client-${Date.now()}`,
    name: getText(item.name),
    phone: getText(item.phone),
    instagramHandle: getText(item.instagramHandle),
    email: getText(item.email),
    age: getText(item.age),
    gender: getText(item.gender),
    height: getText(item.height),
    weight: getText(item.weight),
    dietType: getText(item.dietType),
    allergies: getText(item.allergies),
    healthIssues: getText(item.healthIssues),
    goal: getText(item.goal),
    workoutStatus: getText(item.workoutStatus),
    workoutType: getText(item.workoutType),
    medicinesSupplements: getText(item.medicinesSupplements),
    preferences: getText(item.preferences),
    wakeSleepTime: getText(item.wakeSleepTime),
    cuisinePreference: getText(item.cuisinePreference),
    budgetPreference: getText(item.budgetPreference),
    currentEatingPattern: getText(item.currentEatingPattern),
    packageName: getText(item.packageName),
    amount: getText(item.amount),
    paymentStatus: getPaymentStatus(item.paymentStatus),
    status: getClientStatus(item.status),
    followUpDate: getText(item.followUpDate),
    notes: getText(item.notes),
    createdAt: getText(item.createdAt) || now,
    updatedAt: getText(item.updatedAt) || now,
  });
};

export const normalizeAdminClients = (value: unknown): AdminClient[] =>
  Array.isArray(value) ? value.map(normalizeAdminClient) : [];

export const readAdminClients = (): AdminClient[] => {
  try {
    return normalizeAdminClients(
      JSON.parse(window.localStorage.getItem(ADMIN_CLIENTS_STORAGE_KEY) || '[]'),
    );
  } catch {
    return [];
  }
};

const mapClientRowToAdminClient = (row: ClientRow): AdminClient =>
  createAdminClient({
    id: row.id,
    name: row.name,
    phone: row.phone,
    instagramHandle: row.instagram_handle,
    email: row.email,
    age: row.age,
    gender: row.gender,
    height: row.height,
    weight: row.weight,
    dietType: row.diet_type,
    allergies: row.allergies,
    healthIssues: row.health_issues,
    goal: row.goal,
    workoutStatus: row.workout_status,
    workoutType: row.workout_type,
    medicinesSupplements: row.medicines_supplements,
    preferences: row.preferences,
    wakeSleepTime: row.wake_sleep_time,
    cuisinePreference: row.cuisine_preference,
    budgetPreference: row.budget_preference,
    currentEatingPattern: row.current_eating_pattern,
    packageName: row.package_name,
    amount: row.amount === null ? '' : row.amount.toString(),
    paymentStatus: row.payment_status,
    status: row.status,
    followUpDate: row.follow_up_date || '',
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

const mapAdminClientToClientRow = (
  client: AdminClient,
  ownerId: string,
): Omit<ClientRow, 'created_at' | 'updated_at'> => ({
  id: client.id,
  owner_id: ownerId,
  name: client.name,
  phone: client.phone,
  instagram_handle: client.instagramHandle,
  email: client.email,
  age: client.age,
  gender: client.gender,
  height: client.height,
  weight: client.weight,
  diet_type: client.dietType,
  allergies: client.allergies,
  health_issues: client.healthIssues,
  goal: client.goal,
  workout_status: client.workoutStatus,
  workout_type: client.workoutType,
  medicines_supplements: client.medicinesSupplements,
  preferences: client.preferences,
  wake_sleep_time: client.wakeSleepTime,
  cuisine_preference: client.cuisinePreference,
  budget_preference: client.budgetPreference,
  current_eating_pattern: client.currentEatingPattern,
  package_name: client.packageName,
  amount: parseAmount(client.amount),
  payment_status: client.paymentStatus,
  status: client.status,
  follow_up_date: client.followUpDate || null,
  notes: client.notes,
});

export const readAdminClientsAsync = async (): Promise<AdminClient[]> => {
  if (!isSupabaseConfigured) {
    return readAdminClients();
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from('clients')
    .select('*')
    .order('updated_at', { ascending: false })
    .returns<ClientRow[]>();

  if (error) {
    throw error;
  }

  return (data || []).map(mapClientRowToAdminClient);
};

export const writeAdminClients = (clients: AdminClient[]): void => {
  window.localStorage.setItem(
    ADMIN_CLIENTS_STORAGE_KEY,
    JSON.stringify(clients),
  );
};

export const removeAdminDietPlanRecord = (
  records: AdminDietPlanRecord[],
  recordId: string,
): AdminDietPlanRecord[] =>
  records.filter((record) => record.id !== recordId);

export const removeAdminClientFromLists = (
  clients: AdminClient[],
  records: AdminDietPlanRecord[],
  clientId: string,
): { clients: AdminClient[]; records: AdminDietPlanRecord[] } => ({
  clients: clients.filter((client) => client.id !== clientId),
  records: records.filter((record) => record.clientId !== clientId),
});

export const saveAdminClientAsync = async (
  client: AdminClient,
): Promise<AdminClient> => {
  const now = new Date().toISOString();
  const clientToSave = createAdminClient({
    ...client,
    createdAt: client.createdAt || now,
    updatedAt: now,
  });

  if (!isSupabaseConfigured) {
    const clients = readAdminClients();
    const exists = clients.some((item) => item.id === clientToSave.id);
    const nextClients = exists
      ? clients.map((item) => (item.id === clientToSave.id ? clientToSave : item))
      : [clientToSave, ...clients];
    writeAdminClients(nextClients);
    return clientToSave;
  }

  const supabaseClient = requireSupabase();
  const ownerId = await getAuthenticatedUserId();
  const { data, error } = await supabaseClient
    .from('clients')
    .upsert(mapAdminClientToClientRow(clientToSave, ownerId))
    .select('*')
    .single<ClientRow>();

  if (error) {
    throw error;
  }

  return data ? mapClientRowToAdminClient(data) : clientToSave;
};

export const createDietPlanFromAdminClient = (
  client: AdminClient,
): DietPlan => {
  const plan = createEmptyDietPlan();

  return {
    ...plan,
    id: createId('diet-plan'),
    sourceClientId: client.id,
    title: `${client.name.trim() || 'Patient'} Weekly Diet Plan`,
    patient: {
      ...plan.patient,
      name: client.name,
      phone: client.phone,
      instagramHandle: client.instagramHandle,
      age: client.age,
      height: client.height,
      weight: client.weight,
      dietType: client.dietType,
      allergies: client.allergies,
      healthIssues: client.healthIssues,
      goal: client.goal,
      workoutStatus: client.workoutStatus,
      workoutType: client.workoutType,
      medicinesSupplements: client.medicinesSupplements,
      preferences: [
        client.preferences,
        client.wakeSleepTime ? `Wake/sleep: ${client.wakeSleepTime}` : '',
        client.cuisinePreference
          ? `Cuisine: ${client.cuisinePreference}`
          : '',
        client.budgetPreference ? `Budget: ${client.budgetPreference}` : '',
        client.currentEatingPattern
          ? `Current eating: ${client.currentEatingPattern}`
          : '',
      ]
        .filter(Boolean)
        .join(' | '),
    },
    updatedAt: new Date().toISOString(),
  };
};

const getDateInputValue = (date = new Date()): string => {
  const offsetDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );

  return offsetDate.toISOString().slice(0, 10);
};

const buildClientPatientDetails = (
  client: AdminClient,
  fallback: DietPlan['patient'],
): DietPlan['patient'] => ({
  ...fallback,
  name: client.name || fallback.name,
  phone: client.phone || fallback.phone,
  instagramHandle: client.instagramHandle || fallback.instagramHandle,
  age: client.age || fallback.age,
  height: client.height || fallback.height,
  weight: client.weight || fallback.weight,
  dietType: client.dietType || fallback.dietType,
  allergies: client.allergies || fallback.allergies,
  healthIssues: client.healthIssues || fallback.healthIssues,
  goal: client.goal || fallback.goal,
  workoutStatus: client.workoutStatus || fallback.workoutStatus,
  workoutType: client.workoutType || fallback.workoutType,
  medicinesSupplements:
    client.medicinesSupplements || fallback.medicinesSupplements,
  preferences: [
    client.preferences,
    client.wakeSleepTime ? `Wake/sleep: ${client.wakeSleepTime}` : '',
    client.cuisinePreference ? `Cuisine: ${client.cuisinePreference}` : '',
    client.budgetPreference ? `Budget: ${client.budgetPreference}` : '',
    client.currentEatingPattern
      ? `Current eating: ${client.currentEatingPattern}`
      : '',
  ]
    .filter(Boolean)
    .join(' | ') || fallback.preferences,
});

export const createRenewedDietPlanFromRecord = (
  record: AdminDietPlanRecord,
  client?: AdminClient | null,
): DietPlan => {
  const sourcePlan = normalizeDietPlan(record.plan);
  const patient = client
    ? buildClientPatientDetails(client, sourcePlan.patient)
    : sourcePlan.patient;
  const now = new Date().toISOString();
  const patientName = patient.name.trim() || record.patientName || 'Patient';

  return normalizeDietPlan({
    ...sourcePlan,
    id: createId('diet-plan-renewal'),
    sourceClientId: client?.id || record.clientId || sourcePlan.sourceClientId,
    title: `${patientName} Diet Plan - Renewal`,
    patient: {
      ...patient,
      startDate: getDateInputValue(),
    },
    updatedAt: now,
  });
};

export const normalizeAdminDietPlanRecord = (
  value: unknown,
): AdminDietPlanRecord | null => {
  const item = getObject(value);
  const rawPlan = item.plan;

  if (!rawPlan) {
    return null;
  }

  const plan = normalizeDietPlan(rawPlan);
  const now = new Date().toISOString();

  return {
    id: getText(item.id) || plan.id,
    clientId: getText(item.clientId) || plan.sourceClientId || '',
    patientName:
      getText(item.patientName) || plan.patient.name.trim() || 'Patient',
    title: getText(item.title) || plan.title,
    goal: getText(item.goal) || plan.patient.goal,
    status: item.status === 'final' ? 'final' : 'draft',
    plan,
    pdfPath: getText(item.pdfPath) || getText(item.pdf_path),
    createdAt: getText(item.createdAt) || now,
    updatedAt: getText(item.updatedAt) || now,
  };
};

export const normalizeAdminDietPlanRecords = (
  value: unknown,
): AdminDietPlanRecord[] =>
  Array.isArray(value)
    ? value
        .map(normalizeAdminDietPlanRecord)
        .filter((record): record is AdminDietPlanRecord => Boolean(record))
    : [];

export const readAdminDietPlanRecords = (): AdminDietPlanRecord[] => {
  try {
    return normalizeAdminDietPlanRecords(
      JSON.parse(
        window.localStorage.getItem(ADMIN_PLAN_RECORDS_STORAGE_KEY) || '[]',
      ),
    );
  } catch {
    return [];
  }
};

const mapDietPlanRowToAdminRecord = (row: DietPlanRow): AdminDietPlanRecord => {
  const plan = normalizeDietPlan(row.plan_json);

  return {
    id: row.id,
    clientId: row.client_id || '',
    patientName: plan.patient.name.trim() || 'Patient',
    title: row.title || plan.title,
    goal: row.goal || plan.patient.goal,
    status: row.status,
    plan,
    pdfPath: row.pdf_path || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const mapPlanToDietPlanRow = (
  plan: DietPlan,
  ownerId: string,
  status: AdminDietPlanRecord['status'],
  pdfPath = '',
): Omit<DietPlanRow, 'created_at' | 'updated_at'> => ({
  id: plan.id,
  owner_id: ownerId,
  client_id: plan.sourceClientId || null,
  title: plan.title.trim() || 'Weekly Diet Plan',
  goal: plan.patient.goal.trim(),
  status,
  plan_json: normalizeDietPlan(plan),
  pdf_path: pdfPath || null,
});

export const readAdminDietPlanRecordsAsync = async (): Promise<
  AdminDietPlanRecord[]
> => {
  if (!isSupabaseConfigured) {
    return readAdminDietPlanRecords();
  }

  const client = requireSupabase();
  const { data, error } = await client
    .from('diet_plans')
    .select('*')
    .order('updated_at', { ascending: false })
    .returns<DietPlanRow[]>();

  if (error) {
    throw error;
  }

  return (data || []).map(mapDietPlanRowToAdminRecord);
};

export const writeAdminDietPlanRecords = (
  records: AdminDietPlanRecord[],
): void => {
  window.localStorage.setItem(
    ADMIN_PLAN_RECORDS_STORAGE_KEY,
    JSON.stringify(records),
  );
};

const removeStoredPdfPaths = async (paths: string[]): Promise<void> => {
  if (!paths.length) {
    return;
  }

  const client = requireSupabase();
  const { error } = await client.storage.from(DIET_PLAN_PDF_BUCKET).remove(paths);

  if (error) {
    throw error;
  }
};

export const saveAdminDietPlanRecord = (
  plan: DietPlan,
  status: AdminDietPlanRecord['status'] = 'draft',
): AdminDietPlanRecord => {
  const records = readAdminDietPlanRecords();
  const normalizedPlan = normalizeDietPlan(plan);
  const now = new Date().toISOString();
  const existingRecord = records.find((record) => record.id === normalizedPlan.id);
  const nextRecord: AdminDietPlanRecord = {
    id: normalizedPlan.id,
    clientId: normalizedPlan.sourceClientId || '',
    patientName: normalizedPlan.patient.name.trim() || 'Patient',
    title: normalizedPlan.title.trim() || 'Weekly Diet Plan',
    goal: normalizedPlan.patient.goal.trim(),
    status,
    plan: normalizedPlan,
    pdfPath: existingRecord?.pdfPath || '',
    createdAt: existingRecord?.createdAt || now,
    updatedAt: now,
  };
  const nextRecords = existingRecord
    ? records.map((record) =>
        record.id === nextRecord.id ? nextRecord : record,
      )
    : [nextRecord, ...records];

  writeAdminDietPlanRecords(nextRecords);

  if (nextRecord.clientId) {
    const clients = readAdminClients();
    const nextClientStatus: AdminClientStatus =
      status === 'final' ? 'planSent' : 'planPending';
    const nextClients = clients.map((client) =>
      client.id === nextRecord.clientId
        ? {
            ...client,
            status: nextClientStatus,
            updatedAt: now,
          }
        : client,
    );
    writeAdminClients(nextClients);
  }

  return nextRecord;
};

export const saveAdminDietPlanRecordAsync = async (
  plan: DietPlan,
  status: AdminDietPlanRecord['status'] = 'draft',
  options: { pdfBlob?: Blob; pdfFileName?: string } = {},
): Promise<AdminDietPlanRecord> => {
  if (!isSupabaseConfigured) {
    return saveAdminDietPlanRecord(plan, status);
  }

  const client = requireSupabase();
  const ownerId = await getAuthenticatedUserId();
  const normalizedPlan = normalizeDietPlan(plan);
  let pdfPath = '';

  if (options.pdfBlob) {
    const pdfFileName = options.pdfFileName || `${normalizedPlan.id}.pdf`;
    const safeFileName = pdfFileName.replace(/[^a-z0-9.-]+/gi, '-');
    pdfPath = [
      ownerId,
      normalizedPlan.sourceClientId || 'unassigned',
      normalizedPlan.id,
      safeFileName,
    ].join('/');

    const { error: uploadError } = await client.storage
      .from(DIET_PLAN_PDF_BUCKET)
      .upload(pdfPath, options.pdfBlob, {
        cacheControl: '3600',
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }
  }

  if (!pdfPath) {
    const existingRecord = await client
      .from('diet_plans')
      .select('pdf_path')
      .eq('id', normalizedPlan.id)
      .maybeSingle<{ pdf_path: string | null }>();

    if (existingRecord.error) {
      throw existingRecord.error;
    }

    pdfPath = existingRecord.data?.pdf_path || '';
  }

  const { data, error } = await client
    .from('diet_plans')
    .upsert(mapPlanToDietPlanRow(normalizedPlan, ownerId, status, pdfPath))
    .select('*')
    .single<DietPlanRow>();

  if (error) {
    throw error;
  }

  if (normalizedPlan.sourceClientId) {
    await client
      .from('clients')
      .update({ status: status === 'final' ? 'planSent' : 'planPending' })
      .eq('id', normalizedPlan.sourceClientId)
      .eq('owner_id', ownerId);
  }

  return data
    ? mapDietPlanRowToAdminRecord(data)
    : normalizeAdminDietPlanRecord({
        id: normalizedPlan.id,
        clientId: normalizedPlan.sourceClientId || '',
        plan: normalizedPlan,
        status,
        pdfPath,
      })!;
};

export const getAdminDietPlanPdfSignedUrl = async (
  record: AdminDietPlanRecord,
): Promise<string> => {
  if (!record.pdfPath) {
    throw new Error('No PDF is stored for this plan yet.');
  }

  if (!isSupabaseConfigured) {
    throw new Error('Stored PDFs are available after Supabase setup.');
  }

  const client = requireSupabase();
  const { data, error } = await client.storage
    .from(DIET_PLAN_PDF_BUCKET)
    .createSignedUrl(record.pdfPath, 60 * 10);

  if (error) {
    throw error;
  }

  return data.signedUrl;
};

export const deleteAdminDietPlanRecordAsync = async (
  record: AdminDietPlanRecord,
): Promise<void> => {
  if (!isSupabaseConfigured) {
    writeAdminDietPlanRecords(
      removeAdminDietPlanRecord(readAdminDietPlanRecords(), record.id),
    );
    return;
  }

  const client = requireSupabase();
  const ownerId = await getAuthenticatedUserId();

  if (record.pdfPath) {
    await removeStoredPdfPaths([record.pdfPath]);
  }

  const { error } = await client
    .from('diet_plans')
    .delete()
    .eq('id', record.id)
    .eq('owner_id', ownerId);

  if (error) {
    throw error;
  }
};

export const deleteAdminClientAsync = async (
  clientId: string,
): Promise<void> => {
  if (!isSupabaseConfigured) {
    const nextData = removeAdminClientFromLists(
      readAdminClients(),
      readAdminDietPlanRecords(),
      clientId,
    );
    writeAdminClients(nextData.clients);
    writeAdminDietPlanRecords(nextData.records);
    return;
  }

  const client = requireSupabase();
  const ownerId = await getAuthenticatedUserId();
  const { data, error: readPlansError } = await client
    .from('diet_plans')
    .select('id,pdf_path')
    .eq('client_id', clientId)
    .eq('owner_id', ownerId)
    .returns<Array<Pick<DietPlanRow, 'id' | 'pdf_path'>>>();

  if (readPlansError) {
    throw readPlansError;
  }

  const pdfPaths = (data || [])
    .map((record) => record.pdf_path)
    .filter((path): path is string => Boolean(path));

  await removeStoredPdfPaths(pdfPaths);

  const { error: deletePlansError } = await client
    .from('diet_plans')
    .delete()
    .eq('client_id', clientId)
    .eq('owner_id', ownerId);

  if (deletePlansError) {
    throw deletePlansError;
  }

  const { error: deleteClientError } = await client
    .from('clients')
    .delete()
    .eq('id', clientId)
    .eq('owner_id', ownerId);

  if (deleteClientError) {
    throw deleteClientError;
  }
};

export const buildClientIntakeMessage = (client?: AdminClient): string => {
  const name = client?.name.trim();

  return [
    name ? `Hi ${name}, please share these details:` : 'Please share these details:',
    '',
    '1. Age, height, weight',
    '2. Goal: weight loss, weight gain, PCOS, thyroid, diabetes, muscle gain, or maintenance',
    '3. Diet type: veg, eggetarian, or non-veg',
    '4. Allergies or foods that do not suit you',
    '5. Health issues: PCOS, thyroid, diabetes, acidity, BP, etc.',
    '6. Workout: yes/no and type',
    '7. Medicines or supplements',
    '8. Wake-up time and sleep time',
    '9. Food likes, dislikes, and cuisine preference',
    '10. Current eating pattern from morning to night',
  ].join('\n');
};
