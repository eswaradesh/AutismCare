export interface TherapistChildSummaryApi {
  relationship_id: string;
  child_id: string;
  child_name: string;
  parent_id: string;
  parent_name: string;
  status: string;
  last_report_date?: string | null;
  routine_count?: number;
  behavior_count?: number;
  needs_attention?: boolean;
}

export interface TherapistChildProfileApi {
  relationship_id?: string | null;
  child_id: string;
  child_name: string;
  age_years: number;
  age_months: number;
  communication_level: string;
  sensory_preference: string;
  parent_id: string;
  parent_name: string;
}

export interface TherapistSuggestionApi {
  id: string;
  therapist_id: string;
  parent_id: string;
  child_id: string;
  title: string;
  description: string | null;
  related_pattern: string | null;
  suggested_frequency: string | null;
  status: string;
  created_at: string;
}

export interface TherapistNoteApi {
  id: string;
  therapist_id: string;
  parent_id: string;
  child_id: string;
  note_text: string;
  note_type: string;
  created_at: string;
}

export interface TherapistRoutineEntryApi {
  id: string;
  child_id: string;
  date: string;
  type: string;
  notes: string | null;
  created_at: string;
}

export interface TherapistBehaviorEntryApi {
  id: string;
  child_id: string;
  date: string;
  emotion: string;
  intensity: string;
  is_sudden: boolean;
  created_at: string;
}

export interface TherapistChildEntriesApi {
  routines: TherapistRoutineEntryApi[];
  behaviors: TherapistBehaviorEntryApi[];
}

export interface TherapistAlertReviewApi {
  id: string;
  response_note: string | null;
  acknowledged: boolean;
  reviewed_at: string | null;
}

export interface TherapistBehaviorAlertApi {
  id: string;
  child_id: string;
  child_name: string;
  parent_id: string;
  parent_name: string;
  emotion: string;
  intensity: string;
  notes: string | null;
  alert_type: string;
  created_at: string;
  reviewed: boolean;
  review: TherapistAlertReviewApi | null;
}

export interface TherapistIntensityAlertApi {
  id: string;
  parent_id: string;
  parent_name: string;
  child_id: string;
  child_name: string;
  consecutive_high_count: number;
  alert_sent_at: string | null;
  acknowledged: boolean;
  created_at: string;
}

export interface TherapistProfileStatusApi {
  verification_status: string;
  rejection_reason: string | null;
}

export interface TherapistAuthUserApi {
  id: string;
  email: string;
  full_name: string | null;
}

export interface TherapistProfileBasicApi {
  id: string;
  full_name: string;
  qualification: string;
  specialization: string | null;
  registration_number: string;
  clinic_name: string | null;
  verification_status: string;
}

export interface TherapistAuthResponseApi {
  access_token: string;
  token_type: string;
  user: TherapistAuthUserApi;
  therapist_profile: TherapistProfileBasicApi;
}

export interface PublicTherapistDirectoryItemApi {
  id: string;
  user_id: string;
  full_name: string;
  qualification: string;
  specialization: string | null;
  clinic_name: string | null;
  contact_email: string | null;
  verification_status: string;
}

export interface ParentTherapistRelationshipApi {
  id: string;
  parent_id: string;
  therapist_id: string;
  child_id: string | null;
  status: string;
  created_at: string;
}

function resolveApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_BACKEND_API_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:8002`;
  }

  return "http://127.0.0.1:8002";
}

const API_BASE_URL = resolveApiBaseUrl();
const THERAPIST_AUTH_TOKEN_KEY = "therapistAuthToken";
let activeApiBaseUrl = API_BASE_URL;

function buildApiBaseCandidates(): string[] {
  const candidates: string[] = [];
  const configuredUrl = import.meta.env.VITE_BACKEND_API_URL?.trim();

  if (configuredUrl) {
    candidates.push(configuredUrl.replace(/\/$/, ""));
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;

    candidates.push(`${protocol}//${hostname}:8002`);
    candidates.push(`${protocol}//localhost:8002`);
    candidates.push(`${protocol}//127.0.0.1:8002`);
  } else {
    candidates.push("http://127.0.0.1:8002");
  }

  const uniqueCandidates = candidates.filter((candidate, index, arr) => arr.indexOf(candidate) === index);
  return uniqueCandidates;
}

function extractPathFromInput(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    if (input.startsWith("/")) {
      return input;
    }

    try {
      const parsed = new URL(input);
      return `${parsed.pathname}${parsed.search}`;
    } catch {
      return `/${input.replace(/^\/+/, "")}`;
    }
  }

  if (input instanceof URL) {
    return `${input.pathname}${input.search}`;
  }

  const requestUrl = input.url;
  try {
    const parsed = new URL(requestUrl);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return `/${requestUrl.replace(/^\/+/, "")}`;
  }
}

async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = extractPathFromInput(input);
  const candidates = [activeApiBaseUrl, ...buildApiBaseCandidates()].filter(
    (candidate, index, arr) => arr.indexOf(candidate) === index,
  );

  let lastNetworkError: unknown = null;
  let lastServerErrorResponse: Response | null = null;

  for (const baseUrl of candidates) {
    const requestUrl = `${baseUrl}${path}`;
    try {
      const response = await fetch(requestUrl, init);

      if (response.ok || response.status < 500) {
        activeApiBaseUrl = baseUrl;
        return response;
      }

      lastServerErrorResponse = response;
    } catch (error) {
      lastNetworkError = error;
    }
  }

  if (lastServerErrorResponse) {
    return lastServerErrorResponse;
  }

  if (lastNetworkError instanceof TypeError) {
    throw new Error(
      `Unable to reach backend API. Tried: ${candidates.join(", ")}. Ensure the backend is running and VITE_BACKEND_API_URL is configured correctly.`,
    );
  }

  throw lastNetworkError instanceof Error ? lastNetworkError : new Error("Unable to reach backend API.");
}

async function parseApiError(response: Response): Promise<string> {
  const raw = await response.text();
  if (!raw) {
    return `Request failed with status ${response.status}`;
  }

  try {
    const parsed = JSON.parse(raw) as { detail?: string };
    if (parsed.detail) {
      return parsed.detail;
    }
  } catch {
    // Non-JSON response body; fall back to raw text.
  }

  return raw;
}

export function getTherapistAuthToken(): string | null {
  return localStorage.getItem(THERAPIST_AUTH_TOKEN_KEY);
}

export function setTherapistAuthToken(token: string): void {
  localStorage.setItem(THERAPIST_AUTH_TOKEN_KEY, token);
}

export function clearTherapistAuthToken(): void {
  localStorage.removeItem(THERAPIST_AUTH_TOKEN_KEY);
}

function buildAuthHeaders(): Record<string, string> {
  const token = getTherapistAuthToken();
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  return {};
}

async function apiGet<T>(path: string, userId?: string): Promise<T> {
  const response = await safeFetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as T;
}

async function apiSend<T>(
  method: "POST" | "DELETE" | "PATCH",
  path: string,
  userId?: string,
  body?: unknown,
): Promise<T> {
  const response = await safeFetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export async function getTherapistChildren(userId: string): Promise<TherapistChildSummaryApi[]> {
  return apiGet<TherapistChildSummaryApi[]>("/therapist/children", userId);
}

export async function getTherapistChildProfile(userId: string, refId: string): Promise<TherapistChildProfileApi> {
  return apiGet<TherapistChildProfileApi>(`/therapist/children/${refId}/profile`, userId);
}

export async function getTherapistSuggestions(userId: string, refId: string): Promise<TherapistSuggestionApi[]> {
  return apiGet<TherapistSuggestionApi[]>(`/therapist/children/${refId}/suggestions`, userId);
}

export async function createTherapistSuggestion(
  userId: string,
  refId: string,
  payload: {
    title: string;
    description?: string | null;
    related_pattern?: string | null;
    suggested_frequency?: string | null;
  },
): Promise<TherapistSuggestionApi> {
  return apiSend<TherapistSuggestionApi>("POST", `/therapist/children/${refId}/suggestions`, userId, payload);
}

export async function deleteTherapistSuggestion(userId: string, suggestionId: string): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>("DELETE", `/therapist/suggestions/${suggestionId}`, userId);
}

export async function getTherapistNotes(userId: string, refId: string): Promise<TherapistNoteApi[]> {
  return apiGet<TherapistNoteApi[]>(`/therapist/children/${refId}/notes`, userId);
}

export async function createTherapistNote(
  userId: string,
  refId: string,
  payload: { note_text: string; note_type?: string },
): Promise<TherapistNoteApi> {
  return apiSend<TherapistNoteApi>("POST", `/therapist/children/${refId}/notes`, userId, payload);
}

export async function deleteTherapistNote(userId: string, noteId: string): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>("DELETE", `/therapist/notes/${noteId}`, userId);
}

export async function getTherapistChildEntries(userId: string, refId: string): Promise<TherapistChildEntriesApi> {
  return apiGet<TherapistChildEntriesApi>(`/therapist/children/${refId}/entries`, userId);
}

export async function getTherapistAlerts(userId: string): Promise<TherapistBehaviorAlertApi[]> {
  return apiGet<TherapistBehaviorAlertApi[]>("/therapist/alerts", userId);
}

export async function acknowledgeTherapistAlert(
  userId: string,
  alertId: string,
  payload: { response_note?: string | null },
): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>("POST", `/therapist/alerts/${alertId}/acknowledge`, userId, payload);
}

export async function getTherapistIntensityAlerts(userId: string): Promise<TherapistIntensityAlertApi[]> {
  return apiGet<TherapistIntensityAlertApi[]>("/therapist/intensity-alerts", userId);
}

export async function acknowledgeTherapistIntensityAlert(userId: string, alertId: string): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>("POST", `/therapist/intensity-alerts/${alertId}/acknowledge`, userId);
}

export async function getTherapistProfileStatus(userId: string): Promise<TherapistProfileStatusApi> {
  return apiGet<TherapistProfileStatusApi>("/therapist/profile-status", userId);
}

export async function therapistLogin(email: string, password: string): Promise<TherapistAuthResponseApi> {
  const response = await safeFetch(`${API_BASE_URL}/auth/therapist/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as TherapistAuthResponseApi;
  setTherapistAuthToken(data.access_token);
  return data;
}

export async function getTherapistSession(): Promise<TherapistAuthResponseApi> {
  const data = await apiGet<TherapistAuthResponseApi>("/therapist/me");
  if (data.access_token) {
    setTherapistAuthToken(data.access_token);
  }
  return data;
}

export async function getVerifiedTherapistDirectory(): Promise<PublicTherapistDirectoryItemApi[]> {
  return apiGet<PublicTherapistDirectoryItemApi[]>("/public/therapists/verified");
}

export async function getParentTherapistRelationships(
  parentId: string,
  childId?: string,
): Promise<ParentTherapistRelationshipApi[]> {
  const params = new URLSearchParams();
  if (childId) {
    params.set("child_id", childId);
  }
  const query = params.toString();
  const res = await parentFetch(`/parent-therapist/relationships${query ? `?${query}` : ""}`);
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function connectParentToTherapist(payload: {
  parent_id: string;
  parent_email: string;
  parent_name?: string;
  child_id: string;
  child_name?: string;
  therapist_id: string;
}): Promise<{ ok: boolean; relationship_id: string; status: string }> {
  const res = await parentFetch("/parent-therapist/connect", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function revokeParentTherapistRelationship(
  relationshipId: string,
  parentId: string,
): Promise<{ ok: boolean }> {
  const res = await parentFetch(`/parent-therapist/${relationshipId}/revoke`, {
    method: "POST",
    body: JSON.stringify({ parent_id: parentId }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function updateRelationshipAccess(
  relationshipId: string,
  accessSettings: any,
): Promise<{ ok: boolean }> {
  // Stub for updating relationship access until backend endpoint is fully implemented
  console.log('Update relationship access called for', relationshipId, accessSettings);
  return { ok: true };
}

export async function registerTherapistAccount(
  payload: {
    email: string;
    password: string;
    full_name: string;
    qualification: string;
    registration_number: string;
    specialization?: string;
    clinic_name?: string;
    contact_email?: string;
  },
  files?: {
    degree_certificate?: File | null;
    license_document?: File | null;
  },
): Promise<TherapistAuthResponseApi> {
  const formData = new FormData();
  formData.append("email", payload.email);
  formData.append("password", payload.password);
  formData.append("full_name", payload.full_name);
  formData.append("qualification", payload.qualification);
  formData.append("registration_number", payload.registration_number);

  if (payload.specialization) formData.append("specialization", payload.specialization);
  if (payload.clinic_name) formData.append("clinic_name", payload.clinic_name);
  if (payload.contact_email) formData.append("contact_email", payload.contact_email);

  if (files?.degree_certificate) {
    formData.append("degree_certificate", files.degree_certificate);
  }
  if (files?.license_document) {
    formData.append("license_document", files.license_document);
  }

  const response = await safeFetch(`${API_BASE_URL}/auth/therapist/register`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as TherapistAuthResponseApi;
  setTherapistAuthToken(data.access_token);
  return data;
}

export async function registerTherapistProfile(
  payload: {
    user_id: string;
    full_name: string;
    qualification: string;
    registration_number: string;
    specialization?: string;
    clinic_name?: string;
    contact_email?: string;
  },
  files?: {
    degree_certificate?: File | null;
    license_document?: File | null;
  },
): Promise<{ ok: boolean }> {
  const formData = new FormData();
  formData.append("user_id", payload.user_id);
  formData.append("full_name", payload.full_name);
  formData.append("qualification", payload.qualification);
  formData.append("registration_number", payload.registration_number);
  formData.append("verification_status", "verified");

  if (payload.specialization) formData.append("specialization", payload.specialization);
  if (payload.clinic_name) formData.append("clinic_name", payload.clinic_name);
  if (payload.contact_email) formData.append("contact_email", payload.contact_email);

  if (files?.degree_certificate) {
    formData.append("degree_certificate", files.degree_certificate);
  }
  if (files?.license_document) {
    formData.append("license_document", files.license_document);
  }

  const response = await safeFetch(`${API_BASE_URL}/therapist/register-profile`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as { ok: boolean };
}

export async function saveChildProfile(payload: {
  user_id: string;
  name: string;
  age_years: number;
  age_months: number;
  communication_level: string;
  sensory_preference: string;
  notes?: string;
}): Promise<{ ok: boolean; id: string }> {
  const res = await parentFetch("/parent/save-child-profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }

  return (await res.json()) as { ok: boolean; id: string };
}

export async function getTherapistAvailability(therapistId: string): Promise<any[]> {
  // Stub until availability endpoints are added
  console.log('getTherapistAvailability stub', therapistId);
  return [];
}

export async function addTherapistAvailability(therapistId: string, data: any): Promise<void> {
  // Stub
  console.log('addTherapistAvailability stub', therapistId, data);
}

export async function deleteTherapistAvailability(availabilityId: string): Promise<void> {
  // Stub
  console.log('deleteTherapistAvailability stub', availabilityId);
}

// ─────────────────────────────────────────
// Parent Auth & Data API
// ─────────────────────────────────────────

const PARENT_AUTH_TOKEN_KEY = "parentAuthToken";

export function getParentAuthToken(): string | null {
  return localStorage.getItem(PARENT_AUTH_TOKEN_KEY);
}

export function setParentAuthToken(token: string): void {
  localStorage.setItem(PARENT_AUTH_TOKEN_KEY, token);
}

export function clearParentAuthToken(): void {
  localStorage.removeItem(PARENT_AUTH_TOKEN_KEY);
}

function parentHeaders(): Record<string, string> {
  const token = getParentAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parentFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const base = activeApiBaseUrl || API_BASE_URL;
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...parentHeaders(), ...(options.headers || {}) },
  });
  return res;
}

export interface ParentUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export async function parentRegister(email: string, password: string, fullName = ""): Promise<{ access_token: string; user: ParentUser }> {
  const res = await parentFetch("/auth/parent/register", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  const data = await res.json();
  setParentAuthToken(data.access_token);
  return data;
}

export async function parentLogin(email: string, password: string): Promise<{ access_token: string; user: ParentUser }> {
  const res = await parentFetch("/auth/parent/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  const data = await res.json();
  setParentAuthToken(data.access_token);
  return data;
}

export async function getParentMe(): Promise<{ access_token: string; user: ParentUser } | null> {
  const token = getParentAuthToken();
  if (!token) return null;
  try {
    const res = await parentFetch("/auth/parent/me");
    if (!res.ok) return null;
    const data = await res.json();
    setParentAuthToken(data.access_token);
    return data;
  } catch {
    return null;
  }
}

export async function getParentData(): Promise<{
  child_profiles?: any[];
  routine_entries: any[];
  behavior_entries: any[];
  medications: any[];
  daily_summaries: any[];
}> {
  const res = await parentFetch("/parent/data");
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function addParentRoutineEntry(entry: {
  child_id?: string | null;
  date: string;
  type: string;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string | null;
  voice_note_url?: string | null;
}): Promise<any> {
  const res = await parentFetch("/parent/routine-entries", { method: "POST", body: JSON.stringify(entry) });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function addParentBehaviorEntry(entry: {
  child_id?: string | null;
  date: string;
  emotion: string;
  intensity: string;
  trigger?: string | null;
  notes?: string | null;
  is_sudden?: boolean;
}): Promise<any> {
  const res = await parentFetch("/parent/behavior-entries", { method: "POST", body: JSON.stringify(entry) });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function addParentMedication(med: {
  child_id?: string | null;
  name: string;
  time?: string | null;
  frequency?: string;
  notes?: string | null;
  enabled?: boolean;
}): Promise<any> {
  const res = await parentFetch("/parent/medications", { method: "POST", body: JSON.stringify(med) });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function updateParentMedication(id: string, update: {
  name?: string;
  time?: string | null;
  frequency?: string;
  notes?: string | null;
  enabled?: boolean;
}): Promise<any> {
  const res = await parentFetch(`/parent/medications/${id}`, { method: "PATCH", body: JSON.stringify(update) });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function deleteParentMedication(id: string): Promise<void> {
  const res = await parentFetch(`/parent/medications/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseApiError(res));
}

export async function getParentChildSuggestions(childId: string): Promise<any[]> {
  try {
    const res = await parentFetch(`/parent/child-suggestions/${childId}`);
    if (!res.ok) {
      console.warn('Failed to load child suggestions:', res.status);
      return [];
    }
    return res.json();
  } catch (err) {
    console.warn('Could not reach suggestions endpoint:', err);
    return [];
  }
}

export async function createSharedReport(data: {
  child_id?: string | null;
  share_token: string;
  report_type?: string;
  date_range_start?: string;
  date_range_end?: string;
  report_data?: object | null;
  expires_at?: string;
}): Promise<{ ok: boolean; token: string }> {
  const res = await parentFetch("/parent/shared-reports", { method: "POST", body: JSON.stringify(data) });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function getSharedReport(token: string): Promise<any> {
  const res = await parentFetch(`/shared-report/${token}`);
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function getLinkedTherapists(): Promise<Array<{ therapist_id: string; child_id: string | null; full_name: string }>> {
  const res = await parentFetch("/parent/linked-therapists");
  if (!res.ok) return [];
  return res.json();
}

export async function shareBehaviorAlert(data: {
  child_id: string;
  behavior_entry_id: string;
  therapist_ids: string[];
  emotion: string;
  intensity: string;
  notes?: string | null;
}): Promise<{ ok: boolean }> {
  const res = await parentFetch("/parent/behavior-alert-share", { method: "POST", body: JSON.stringify(data) });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

