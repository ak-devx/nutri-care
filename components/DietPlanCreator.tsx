import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Instagram,
  Loader2,
  Phone,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type {
  DietPlan,
  DietPlanGuidelineId,
  DietPlanTemplateId,
  MealSlotKey,
} from '../types';
import { generateDietPlanWithAI } from '../services/geminiService';
import {
  applyDietPlanTemplate,
  createEmptyDietPlan,
  DIET_PLAN_GUIDELINE_OPTIONS,
  DIET_PLAN_STORAGE_KEY,
  DIET_PLAN_TEMPLATES,
  formatDietPlanForSharing,
  getDietPlanGuidelineText,
  getWorkoutSummary,
  MEAL_SLOTS,
  mergeGeneratedDietPlan,
  normalizeDietPlan,
  normalizeInstagramHandle,
} from '../utils/dietPlan';
import {
  ADMIN_NOTICE_STORAGE_KEY,
  ADMIN_SESSION_STORAGE_KEY,
  buildAdminClientRouteHash,
  saveAdminDietPlanRecordAsync,
} from '../utils/adminPanel';
import {
  buildDietPlanPdfFileName,
  createDietPlanPdfBlob,
  downloadDietPlanPdf,
} from '../utils/dietPlanPdf';
import {
  getSupabaseSession,
  isSupabaseConfigured,
  supabase,
} from '../utils/supabaseClient';

type NoticeState = {
  type: 'success' | 'error';
  message: string;
} | null;

const inputClassName =
  'w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-leaf-500 focus:ring-2 focus:ring-leaf-100';

const labelClassName = 'mb-2 block text-sm font-semibold text-slate-700';

const DIET_TYPE_OPTIONS = ['Veg', 'Eggetarian', 'Non-veg'] as const;
const WORKOUT_STATUS_OPTIONS = ['Yes', 'No'] as const;
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

const waitForSaveLoaderPaint = (): Promise<void> =>
  new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });

type FlowStep = {
  id: WizardStepId;
  label: string;
  detail: string;
  isDone: boolean;
};

type WizardStepId = 'patient' | 'meals' | 'pdf';

const WIZARD_STEP_ORDER: WizardStepId[] = [
  'patient',
  'meals',
  'pdf',
];

const joinLabels = (values: string[]): string => {
  if (values.length <= 1) {
    return values[0] || '';
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
};

const getAiMissingFields = (plan: DietPlan): string[] => {
  const missingFields: string[] = [];

  if (!plan.patient.age.trim()) {
    missingFields.push('age');
  }

  if (!plan.patient.height.trim()) {
    missingFields.push('height');
  }

  if (!plan.patient.weight.trim()) {
    missingFields.push('weight');
  }

  if (!plan.patient.dietType.trim()) {
    missingFields.push('diet type');
  }

  if (!plan.patient.goal.trim()) {
    missingFields.push('goal');
  }

  if (!plan.patient.workoutStatus.trim()) {
    missingFields.push('workout status');
  }

  if (
    plan.patient.workoutStatus.trim().toLowerCase() === 'yes' &&
    !plan.patient.workoutType.trim()
  ) {
    missingFields.push('workout type');
  }

  return missingFields;
};

const DietPlanCreator: React.FC = () => {
  const [plan, setPlan] = useState<DietPlan>(() => createEmptyDietPlan());
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    !isSupabaseConfigured &&
    window.sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) === 'unlocked',
  );
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] =
    useState<DietPlanTemplateId>('balancedVegetarian');
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isGeneratingDietPlan, setIsGeneratingDietPlan] = useState(false);
  const [savingHistoryStatus, setSavingHistoryStatus] = useState<
    'draft' | 'final' | null
  >(null);
  const [aiReviewNotes, setAiReviewNotes] = useState<string[]>([]);
  const [activeWizardStep, setActiveWizardStep] =
    useState<WizardStepId>('patient');

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        if (isSupabaseConfigured) {
          const session = await getSupabaseSession();
          if (isMounted) {
            setIsAuthenticated(Boolean(session));
          }
          return;
        }

        if (isMounted) {
          setIsAuthenticated(
            window.sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) ===
              'unlocked',
          );
        }
      } catch {
        if (isMounted) {
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    };

    checkAuth();

    if (!supabase) {
      return () => {
        isMounted = false;
      };
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
      setIsCheckingAuth(false);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const savedPlan = window.localStorage.getItem(DIET_PLAN_STORAGE_KEY);

    if (savedPlan) {
      try {
        setPlan(normalizeDietPlan(JSON.parse(savedPlan)));
      } catch {
        window.localStorage.removeItem(DIET_PLAN_STORAGE_KEY);
      }
    }

    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    window.localStorage.setItem(
      DIET_PLAN_STORAGE_KEY,
      JSON.stringify({ ...plan, updatedAt: new Date().toISOString() }),
    );
  }, [isLoaded, plan]);

  const shareText = useMemo(() => formatDietPlanForSharing(plan), [plan]);
  const activeDay = plan.days[activeDayIndex] ?? plan.days[0];
  const workoutSummary = getWorkoutSummary(plan.patient);
  const healthContextAdded = Boolean(
    plan.patient.allergies.trim() ||
      plan.patient.healthIssues.trim() ||
      plan.patient.medicinesSupplements.trim() ||
      plan.patient.preferences.trim(),
  );
  const aiMissingFields = useMemo(() => getAiMissingFields(plan), [plan]);
  const isClientLinked = Boolean(plan.sourceClientId);
  const hasMealDraft = plan.days.some((day) =>
    MEAL_SLOTS.some((slot) => day.meals[slot.id].trim()),
  );
  const hasPdfGuidance = Boolean(
    plan.selectedGuidelines.length || plan.instructions.trim(),
  );
  const flowSteps: FlowStep[] = [
    {
      id: 'patient',
      label: 'Patient',
      detail: isClientLinked ? 'Linked to saved customer' : 'Start from admin client',
      isDone: aiMissingFields.length === 0,
    },
    {
      id: 'meals',
      label: 'Meals',
      detail: hasMealDraft
        ? 'Meals added'
        : aiMissingFields.length
          ? `${aiMissingFields.length} intake field${aiMissingFields.length === 1 ? '' : 's'} needed`
          : 'Generate with AI or enter meals',
      isDone: hasMealDraft,
    },
    {
      id: 'pdf',
      label: 'Save',
      detail: hasPdfGuidance ? 'Ready to save diet plan' : 'Select final PDF notes',
      isDone: hasPdfGuidance,
    },
  ];
  const activeStepIndex = WIZARD_STEP_ORDER.indexOf(activeWizardStep);
  const activeStep = flowSteps.find((step) => step.id === activeWizardStep) || flowSteps[0];
  const canGoBack = activeStepIndex > 0;
  const canGoNext = activeStepIndex < WIZARD_STEP_ORDER.length - 1;
  const isSavingHistory = Boolean(savingHistoryStatus);
  const isSavingDraft = savingHistoryStatus === 'draft';
  const isSavingFinalPlan = savingHistoryStatus === 'final';

  const goToPreviousStep = () => {
    if (!canGoBack) {
      return;
    }

    setActiveWizardStep(WIZARD_STEP_ORDER[activeStepIndex - 1]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToNextStep = () => {
    if (!canGoNext) {
      return;
    }

    setActiveWizardStep(WIZARD_STEP_ORDER[activeStepIndex + 1]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updatePlan = (updater: (current: DietPlan) => DietPlan) => {
    setPlan((current) => ({
      ...updater(current),
      updatedAt: new Date().toISOString(),
    }));
  };

  const updatePatientField = (
    field: keyof DietPlan['patient'],
    value: string,
  ) => {
    updatePlan((current) => ({
      ...current,
      patient: {
        ...current.patient,
        [field]: value,
      },
    }));
  };

  const updateWorkoutStatus = (value: string) => {
    updatePlan((current) => ({
      ...current,
      patient: {
        ...current.patient,
        workoutStatus: value,
        workoutType:
          value.trim().toLowerCase() === 'yes'
            ? current.patient.workoutType
            : '',
      },
    }));
  };

  const updateTopLevelField = (
    field: 'title' | 'dietitianName' | 'instructions',
    value: string,
  ) => {
    updatePlan((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const toggleGuideline = (guidelineId: DietPlanGuidelineId) => {
    updatePlan((current) => {
      const isSelected = current.selectedGuidelines.includes(guidelineId);

      return {
        ...current,
        selectedGuidelines: isSelected
          ? current.selectedGuidelines.filter((item) => item !== guidelineId)
          : [...current.selectedGuidelines, guidelineId],
      };
    });
  };

  const updateMeal = (
    dayIndex: number,
    slotId: MealSlotKey,
    value: string,
  ) => {
    updatePlan((current) => ({
      ...current,
      days: current.days.map((day, index) =>
        index === dayIndex
          ? {
              ...day,
              meals: {
                ...day.meals,
                [slotId]: value,
              },
            }
          : day,
      ),
    }));
  };

  const updateDayNote = (dayIndex: number, value: string) => {
    updatePlan((current) => ({
      ...current,
      days: current.days.map((day, index) =>
        index === dayIndex ? { ...day, note: value } : day,
      ),
    }));
  };

  const handleApplyTemplate = () => {
    updatePlan((current) => applyDietPlanTemplate(current, selectedTemplateId));
    setAiReviewNotes([]);
    setNotice({ type: 'success', message: 'Template applied to the week.' });
  };

  const generatePlanWithAI = async () => {
    const missingFields = aiMissingFields;

    if (missingFields.length > 0) {
      setNotice({
        type: 'error',
        message: `Add ${joinLabels(missingFields)} before generating AI meals.`,
      });
      return;
    }

    setIsGeneratingDietPlan(true);
    setNotice(null);

    try {
      const generatedPlan = await generateDietPlanWithAI(plan);
      updatePlan((current) => mergeGeneratedDietPlan(current, generatedPlan));
      setAiReviewNotes(
        Array.isArray(generatedPlan.reviewNotes)
          ? generatedPlan.reviewNotes.filter(Boolean)
          : [],
      );
      setActiveDayIndex(0);
      setNotice({
        type: 'success',
        message: 'AI meals added. Review and edit before saving.',
      });
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'AI diet plan generation failed. Please try again.',
      });
    } finally {
      setIsGeneratingDietPlan(false);
    }
  };

  const copyPreviousDay = () => {
    if (activeDayIndex === 0) {
      setNotice({ type: 'error', message: 'Monday has no previous day.' });
      return;
    }

    updatePlan((current) => ({
      ...current,
      days: current.days.map((day, index) =>
        index === activeDayIndex
          ? {
              ...day,
              meals: { ...current.days[activeDayIndex - 1].meals },
              note: current.days[activeDayIndex - 1].note,
            }
          : day,
      ),
    }));
    setNotice({ type: 'success', message: 'Previous day copied.' });
  };

  const copyMondayToWeek = () => {
    updatePlan((current) => {
      const monday = current.days[0];

      return {
        ...current,
        days: current.days.map((day, index) =>
          index === 0
            ? day
            : {
                ...day,
                meals: { ...monday.meals },
                note: monday.note,
              },
        ),
      };
    });
    setNotice({ type: 'success', message: 'Monday copied to the week.' });
  };

  const resetDraft = () => {
    const freshPlan = createEmptyDietPlan();
    setPlan(freshPlan);
    setActiveDayIndex(0);
    window.localStorage.removeItem(DIET_PLAN_STORAGE_KEY);
    setNotice({ type: 'success', message: 'Draft cleared.' });
  };

  const handleDownloadPdf = () => {
    try {
      downloadDietPlanPdf(plan);
      setNotice({ type: 'success', message: 'Diet plan PDF downloaded.' });
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'PDF generation failed. Please try again.',
      });
    }
  };

  const saveToAdminHistory = async (status: 'draft' | 'final') => {
    try {
      if (savingHistoryStatus) {
        return;
      }

      if (status === 'final' && !plan.sourceClientId) {
        setNotice({
          type: 'error',
          message:
            'Open this flow from a saved admin client before saving final PDF.',
        });
        return;
      }

      setSavingHistoryStatus(status);
      setNotice(null);
      await waitForSaveLoaderPaint();

      const shouldStorePdf = status === 'final';
      await saveAdminDietPlanRecordAsync(plan, status, {
        pdfBlob: shouldStorePdf ? createDietPlanPdfBlob(plan) : undefined,
        pdfFileName: shouldStorePdf ? buildDietPlanPdfFileName(plan) : undefined,
      });

      const successNotice = {
        type: 'success',
        message:
          status === 'final'
            ? 'Final plan and PDF saved to customer history.'
            : 'Draft saved to admin history.',
      } as const;

      if (status === 'final' && plan.sourceClientId) {
        window.sessionStorage.setItem(
          ADMIN_NOTICE_STORAGE_KEY,
          JSON.stringify(successNotice),
        );
        window.location.hash = buildAdminClientRouteHash(plan.sourceClientId);
        return;
      }

      setNotice(successNotice);
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Could not save plan history in this browser.',
      });
    } finally {
      setSavingHistoryStatus(null);
    }
  };

  const patientSummary = [
    plan.patient.name.trim() || 'New patient',
    plan.patient.goal.trim() || 'Weekly nutrition plan',
  ].join(' - ');

  if (isCheckingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 pt-24 text-slate-900">
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-leaf-600" />
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
        <section className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-leaf-600 text-white">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">
                Admin Login Required
              </h1>
              <p className="text-sm text-slate-500">
                Diet plan creation and customer PDF storage are available only
                inside the authenticated admin workflow.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/admin';
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-leaf-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-leaf-700"
          >
            <ShieldCheck size={18} />
            Go to Admin Login
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pt-24 text-slate-900">
      <section className="border-b border-slate-200 bg-white">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-leaf-600">
                Authenticated diet plan workspace
              </p>
              <h1 className="font-serif text-4xl font-bold text-slate-950 md:text-5xl">
                Create Weekly Diet Plan
              </h1>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Build a complete seven-day plan with six daily meal slots, then
                review meals, choose final PDF notes, and save the diet plan to
                the customer profile.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-leaf-50 px-3 py-1 text-leaf-700">
                  <ShieldCheck size={13} className="mr-1 inline" />
                  Authenticated
                </span>
                <span
                  className={`rounded-full px-3 py-1 ${
                    isClientLinked
                      ? 'bg-leaf-50 text-leaf-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {isClientLinked
                    ? 'Customer linked'
                    : 'Not linked to customer'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#/admin';
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-leaf-300 hover:text-leaf-700"
              >
                <ArrowLeft size={18} />
                Admin
              </button>
              <button
                type="button"
                onClick={() => saveToAdminHistory('draft')}
                disabled={isSavingHistory}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-leaf-300 hover:text-leaf-700 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
              >
                {isSavingDraft ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <FileText size={18} />
                )}
                {isSavingDraft ? 'Saving Draft...' : 'Save Draft'}
              </button>
            </div>
          </div>

          {notice && (
            <div
              className={`mt-6 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${
                notice.type === 'success'
                  ? 'border-leaf-200 bg-leaf-50 text-leaf-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {notice.type === 'success' ? <Check size={18} /> : <FileText size={18} />}
              {notice.message}
            </div>
          )}

          <div className="mt-6 grid gap-3 md:grid-cols-5">
            {flowSteps.map((step, index) => (
              <button
                key={step.label}
                type="button"
                onClick={() => setActiveWizardStep(step.id)}
                disabled={isSavingHistory}
                className={`rounded-lg border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-70 ${
                  step.id === activeWizardStep
                    ? 'border-leaf-500 bg-white shadow-sm ring-2 ring-leaf-100'
                    : step.isDone
                      ? 'border-leaf-200 bg-leaf-50 hover:border-leaf-300'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Step {index + 1}
                  </span>
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      step.isDone
                        ? 'bg-leaf-600 text-white'
                        : 'bg-white text-slate-500'
                    }`}
                  >
                    {step.isDone ? <Check size={14} /> : index + 1}
                  </span>
                </div>
                <p className="font-bold text-slate-900">{step.label}</p>
                <p className="mt-1 text-sm text-slate-500">{step.detail}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto grid gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div className="rounded-lg border border-leaf-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-leaf-600">
                  Step {activeStepIndex + 1} of {WIZARD_STEP_ORDER.length}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  {activeStep.label}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {activeStep.detail}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  disabled={!canGoBack || isSavingHistory}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-leaf-300 hover:text-leaf-700 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
                >
                  <ChevronLeft size={17} />
                  Back
                </button>
                <button
                  type="button"
                  onClick={goToNextStep}
                  disabled={!canGoNext}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-leaf-600 px-5 text-sm font-semibold text-white transition hover:bg-leaf-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {canGoNext ? `Next: ${flowSteps[activeStepIndex + 1].label}` : 'Ready'}
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </div>

          {activeWizardStep === 'patient' && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-leaf-50 text-leaf-700">
                <UserRound size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Patient Details
                </h2>
                <p className="text-sm text-slate-500">{patientSummary}</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label>
                <span className={labelClassName}>Plan Title</span>
                <input
                  value={plan.title}
                  onChange={(event) =>
                    updateTopLevelField('title', event.target.value)
                  }
                  className={inputClassName}
                  placeholder="Weekly Diet Plan"
                />
              </label>
              <label>
                <span className={labelClassName}>Dietitian Name</span>
                <input
                  value={plan.dietitianName}
                  onChange={(event) =>
                    updateTopLevelField('dietitianName', event.target.value)
                  }
                  className={inputClassName}
                  placeholder="Dietitian Iram"
                />
              </label>
              <label>
                <span className={labelClassName}>Patient Name</span>
                <input
                  value={plan.patient.name}
                  onChange={(event) =>
                    updatePatientField('name', event.target.value)
                  }
                  className={inputClassName}
                  placeholder="Patient full name"
                />
              </label>
              <label>
                <span className={labelClassName}>WhatsApp Number</span>
                <div className="relative">
                  <Phone
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={plan.patient.phone}
                    onChange={(event) =>
                      updatePatientField('phone', event.target.value)
                    }
                    className={`${inputClassName} pl-11`}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </label>
              <label>
                <span className={labelClassName}>Instagram Handle</span>
                <div className="relative">
                  <Instagram
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={plan.patient.instagramHandle || ''}
                    onChange={(event) =>
                      updatePatientField('instagramHandle', event.target.value)
                    }
                    onBlur={(event) =>
                      updatePatientField(
                        'instagramHandle',
                        normalizeInstagramHandle(event.target.value),
                      )
                    }
                    className={`${inputClassName} pl-11`}
                    placeholder="@client_username"
                  />
                </div>
              </label>
              <label>
                <span className={labelClassName}>Age</span>
                <input
                  value={plan.patient.age}
                  onChange={(event) =>
                    updatePatientField('age', event.target.value)
                  }
                  className={inputClassName}
                  placeholder="32"
                />
              </label>
              <label>
                <span className={labelClassName}>Height</span>
                <input
                  value={plan.patient.height}
                  onChange={(event) =>
                    updatePatientField('height', event.target.value)
                  }
                  className={inputClassName}
                  placeholder="165 cm"
                />
              </label>
              <label>
                <span className={labelClassName}>Weight</span>
                <input
                  value={plan.patient.weight}
                  onChange={(event) =>
                    updatePatientField('weight', event.target.value)
                  }
                  className={inputClassName}
                  placeholder="68 kg"
                />
              </label>
              <label>
                <span className={labelClassName}>Diet Type</span>
                <select
                  value={plan.patient.dietType}
                  onChange={(event) =>
                    updatePatientField('dietType', event.target.value)
                  }
                  className={inputClassName}
                >
                  <option value="">Select diet type</option>
                  {DIET_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClassName}>Start Date</span>
                <div className="relative">
                  <CalendarDays
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="date"
                    value={plan.patient.startDate}
                    onChange={(event) =>
                      updatePatientField('startDate', event.target.value)
                    }
                    className={`${inputClassName} pl-11`}
                  />
                </div>
              </label>
              <label className="md:col-span-2">
                <span className={labelClassName}>Allergies</span>
                <textarea
                  rows={2}
                  value={plan.patient.allergies}
                  onChange={(event) =>
                    updatePatientField('allergies', event.target.value)
                  }
                  className={inputClassName}
                  placeholder="Peanut allergy, gluten allergy, or None"
                />
              </label>
              <label className="md:col-span-2">
                <span className={labelClassName}>Health Issues</span>
                <textarea
                  rows={2}
                  value={plan.patient.healthIssues}
                  onChange={(event) =>
                    updatePatientField('healthIssues', event.target.value)
                  }
                  className={inputClassName}
                  placeholder="PCOS, thyroid, diabetes, acidity, or None"
                />
              </label>
              <label className="md:col-span-2">
                <span className={labelClassName}>Goal</span>
                <input
                  value={plan.patient.goal}
                  onChange={(event) =>
                    updatePatientField('goal', event.target.value)
                  }
                  className={inputClassName}
                  list="diet-plan-goal-options"
                  placeholder="Select a goal"
                />
                <datalist id="diet-plan-goal-options">
                  {GOAL_DROPDOWN_OPTIONS.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </label>
              <label>
                <span className={labelClassName}>Workout</span>
                <select
                  value={plan.patient.workoutStatus}
                  onChange={(event) => updateWorkoutStatus(event.target.value)}
                  className={inputClassName}
                >
                  <option value="">Select workout status</option>
                  {WORKOUT_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClassName}>Workout Type</span>
                <input
                  value={plan.patient.workoutType}
                  onChange={(event) =>
                    updatePatientField('workoutType', event.target.value)
                  }
                  className={`${inputClassName} disabled:bg-slate-100 disabled:text-slate-400`}
                  placeholder="Walking, strength training, yoga"
                  disabled={plan.patient.workoutStatus.trim().toLowerCase() !== 'yes'}
                />
              </label>
              <label className="md:col-span-2">
                <span className={labelClassName}>Medicines / Supplements</span>
                <textarea
                  rows={2}
                  value={plan.patient.medicinesSupplements}
                  onChange={(event) =>
                    updatePatientField(
                      'medicinesSupplements',
                      event.target.value,
                    )
                  }
                  className={inputClassName}
                  placeholder="Metformin, thyroid medicine, whey protein, vitamin D, or None"
                />
              </label>
              <label className="md:col-span-2">
                <span className={labelClassName}>
                  Food Preferences / Dislikes / Extra Notes
                </span>
                <textarea
                  rows={3}
                  value={plan.patient.preferences}
                  onChange={(event) =>
                    updatePatientField('preferences', event.target.value)
                  }
                  className={inputClassName}
                  placeholder="Likes simple home meals, avoids curd at night, no onion at breakfast"
                />
              </label>
            </div>
          </div>
          )}

          {activeWizardStep === 'meals' && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Weekly Meals
                </h2>
                <p className="text-sm text-slate-500">
                  Generate meals from intake details, then edit portions and swaps day by day.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={generatePlanWithAI}
                  disabled={isGeneratingDietPlan}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-leaf-600 px-4 text-sm font-semibold text-white transition hover:bg-leaf-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isGeneratingDietPlan ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Sparkles size={17} />
                  )}
                  {isGeneratingDietPlan ? 'Generating...' : 'Generate Meals'}
                </button>
                <select
                  value={selectedTemplateId}
                  onChange={(event) =>
                    setSelectedTemplateId(event.target.value as DietPlanTemplateId)
                  }
                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-100"
                >
                  {DIET_PLAN_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleApplyTemplate}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <FileText size={17} />
                  Apply
                </button>
                <button
                  type="button"
                  onClick={copyPreviousDay}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-leaf-300 hover:text-leaf-700"
                >
                  <Copy size={17} />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={copyMondayToWeek}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-leaf-300 hover:text-leaf-700"
                >
                  <Copy size={17} />
                  Monday to Week
                </button>
              </div>
            </div>

            <div className="mb-6 rounded-lg border border-leaf-200 bg-leaf-50 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles size={18} className="text-leaf-700" />
                    <p className="font-bold text-slate-900">AI meal helper</p>
                  </div>
                  <p className="max-w-3xl text-sm text-slate-600">
                    Uses age, height, weight, goal, diet type, allergies, health issues,
                    workout, medicines, and food notes from Patient details.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-white px-3 py-1 text-slate-600">
                    Age: {plan.patient.age.trim() || 'Needed'}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-slate-600">
                    Height/Weight:{' '}
                    {plan.patient.height.trim() && plan.patient.weight.trim()
                      ? `${plan.patient.height.trim()} / ${plan.patient.weight.trim()}`
                      : 'Needed'}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-slate-600">
                    Diet: {plan.patient.dietType.trim() || 'Needed'}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-slate-600">
                    Goal: {plan.patient.goal.trim() || 'Needed'}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-slate-600">
                    Workout: {workoutSummary || 'Needed'}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-slate-600">
                    Health: {healthContextAdded ? 'Added' : 'Not added'}
                  </span>
                </div>
              </div>

              {aiReviewNotes.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="mb-2 text-sm font-bold text-amber-900">
                    Review before saving
                  </p>
                  <ul className="space-y-2 text-sm text-amber-800">
                    {aiReviewNotes.map((note, index) => (
                      <li key={`${note}-${index}`} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
              {plan.days.map((day, index) => (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => setActiveDayIndex(index)}
                  className={`min-h-12 rounded-lg border px-3 text-sm font-semibold transition ${
                    index === activeDayIndex
                      ? 'border-leaf-500 bg-leaf-50 text-leaf-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-leaf-200'
                  }`}
                >
                  {day.label.slice(0, 3)}
                </button>
              ))}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {MEAL_SLOTS.map((slot) => (
                <label key={slot.id}>
                  <span className={labelClassName}>
                    {slot.label} <span className="text-slate-400">({slot.time})</span>
                  </span>
                  <textarea
                    rows={4}
                    value={activeDay.meals[slot.id]}
                    onChange={(event) =>
                      updateMeal(activeDayIndex, slot.id, event.target.value)
                    }
                    className={inputClassName}
                    placeholder={`${slot.label} items, portions, and swaps`}
                  />
                </label>
              ))}
              <label className="md:col-span-2">
                <span className={labelClassName}>Day Note</span>
                <textarea
                  rows={3}
                  value={activeDay.note}
                  onChange={(event) =>
                    updateDayNote(activeDayIndex, event.target.value)
                  }
                  className={inputClassName}
                  placeholder="Hydration, walk, supplement timing, or follow-up note"
                />
              </label>
            </div>
          </div>
          )}

          {activeWizardStep === 'pdf' && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-900">
                Final Instructions
              </h2>
              <button
                type="button"
                onClick={resetDraft}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                <RefreshCcw size={16} />
                Clear Draft
              </button>
            </div>
            <textarea
              rows={4}
              value={plan.instructions}
              onChange={(event) =>
                updateTopLevelField('instructions', event.target.value)
              }
              className={inputClassName}
              placeholder="Water intake, oil limits, follow-up reminders, and special notes"
            />

            <div
              className={`mt-5 rounded-lg border p-4 ${
                isSavingFinalPlan
                  ? 'border-leaf-300 bg-leaf-50'
                  : isClientLinked
                    ? 'border-leaf-200 bg-leaf-50/70'
                    : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div className="flex gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    isSavingFinalPlan
                      ? 'bg-leaf-600 text-white'
                      : isClientLinked
                        ? 'bg-white text-leaf-700'
                        : 'bg-white text-amber-700'
                  }`}
                >
                  {isSavingFinalPlan ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Check size={20} />
                  )}
                </div>
                <div>
                  <p className="font-bold text-slate-900">
                    {isSavingFinalPlan
                      ? 'Saving diet plan...'
                      : 'Save destination'}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {isSavingFinalPlan
                      ? 'Creating the PDF, storing the editable plan, and linking it to this client.'
                      : isClientLinked
                        ? 'The editable plan and PDF will be stored in this client history, then you will return to the client page.'
                        : 'Final saving is available only for plans linked to a saved admin client.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    PDF Guidelines
                  </h3>
                  <p className="text-sm text-slate-500">
                    Select only the points this patient needs.
                  </p>
                </div>
                <span className="text-sm font-semibold text-leaf-700">
                  {plan.selectedGuidelines.length} selected
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {DIET_PLAN_GUIDELINE_OPTIONS.map((option) => {
                  const isSelected = plan.selectedGuidelines.includes(option.id);
                  const guidelineText = getDietPlanGuidelineText(option.id, plan);

                  return (
                    <label
                      key={option.id}
                      className={`flex min-h-24 cursor-pointer gap-3 rounded-lg border p-4 transition ${
                        isSelected
                          ? 'border-leaf-400 bg-leaf-50'
                          : 'border-slate-200 bg-white hover:border-leaf-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleGuideline(option.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-leaf-600 focus:ring-leaf-500"
                      />
                      <span>
                        <span className="block text-sm font-bold text-slate-800">
                          {option.label}
                        </span>
                        <span className="mt-1 block text-sm leading-5 text-slate-500">
                          {guidelineText || option.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <button
                type="button"
                onClick={goToPreviousStep}
                disabled={!canGoBack || isSavingHistory}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-leaf-300 hover:text-leaf-700 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
              >
                <ChevronLeft size={17} />
                Back
              </button>
              <div className="flex flex-wrap gap-3">
                {activeWizardStep === 'pdf' && (
                  <>
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={isSavingHistory}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:border-leaf-300 hover:text-leaf-700 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
                    >
                      <Download size={17} />
                      Preview PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => saveToAdminHistory('final')}
                      disabled={!isClientLinked || isSavingHistory}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-leaf-600 px-5 text-sm font-semibold text-white transition hover:bg-leaf-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      title={
                        isClientLinked
                          ? 'Save diet plan and PDF to this client'
                          : 'Create this plan from a saved admin client first'
                      }
                    >
                      {isSavingFinalPlan ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <Check size={17} />
                      )}
                      {isSavingFinalPlan ? 'Saving Diet Plan...' : 'Save Diet Plan'}
                    </button>
                  </>
                )}
                {canGoNext && (
                  <button
                    type="button"
                    onClick={goToNextStep}
                    disabled={isSavingHistory}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Continue
                    <ChevronRight size={17} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Patient Preview
                </h2>
                <p className="text-sm text-slate-500">
                  {shareText.length.toLocaleString()} characters
                </p>
              </div>
            </div>
            <pre className="max-h-[calc(100vh-220px)] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-5 font-sans text-sm leading-6 text-slate-100">
              {shareText}
            </pre>
          </div>
        </aside>
      </section>
    </main>
  );
};

export default DietPlanCreator;
