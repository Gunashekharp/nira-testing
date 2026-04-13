import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Camera,
  Loader2,
  LogOut,
  PencilLine,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../components/ui/FormFields";
import { ProfileAvatar } from "../../components/ui/ProfileAvatar";
import { useDemoData } from "../../app/DemoDataProvider";
import { ABHALinkingCard } from "../patient/ABHALinkingCard";
import { getCurrentProfile, getCurrentUser } from "./selectors";

const PROFILE_PHOTO_MAX_SIZE_BYTES = 2 * 1024 * 1024;

const copy = {
  patient: {
    title: "Profile",
    subtitle: "Trust + personalization"
  },
  doctor: {
    title: "Doctor profile",
    subtitle: "Manage your visible doctor profile details here."
  },
  nurse: {
    title: "Nurse profile",
    subtitle: "Manage nursing credentials, shift assignment, and handoff-ready contact details."
  },
  admin: {
    title: "Admin profile",
    subtitle: "Keep the clinic admin identity and contact details current for demos and handoff."
  }
};

function buildForm(role, profile, user) {
  const shared = {
    fullName: profile.fullName || "",
    phone: user.phone || "",
    email: user.email || "",
    profilePhoto: profile.profilePhoto || ""
  };

  if (role === "patient") {
    return {
      ...shared,
      preferredLanguage: profile.preferredLanguage || "en",
      age: profile.age ?? "",
      gender: profile.gender || "",
      city: profile.city || "",
      abhaNumber: profile.abhaNumber || "",
      emergencyContactName: profile.emergencyContactName || "",
      emergencyContactPhone: profile.emergencyContactPhone || "",
      notes: profile.notes || ""
    };
  }

  if (role === "doctor") {
    return {
      ...shared,
      specialty: profile.specialty || "",
      clinic: profile.clinic || "",
      licenseNumber: profile.licenseNumber || "",
      bio: profile.bio || "",
      gender: profile.gender || ""
    };
  }

  if (role === "nurse") {
    return {
      ...shared,
      nursingLicenseNumber: profile.nursingLicenseNumber || "",
      department: profile.department || "General OPD",
      shift: profile.shift || "day",
      assignedWard: profile.assignedWard || "OPD-A",
      yearsExperience: profile.yearsExperience ?? "",
      emergencyContactName: profile.emergencyContactName || "",
      emergencyContactPhone: profile.emergencyContactPhone || "",
      notes: profile.notes || ""
    };
  }

  return {
    ...shared,
    clinicName: profile.clinicName || ""
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read that image. Please try another file."));
    reader.readAsDataURL(file);
  });
}

export function ProfilePage() {
  const { state, actions } = useDemoData();
  const user = getCurrentUser(state);
  const profile = getCurrentProfile(state);
  const fileInputRef = useRef(null);
  const [form, setForm] = useState(() => buildForm(user.role, profile, user));
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [actionFeedback, setActionFeedback] = useState("");
  const [abhaLinking, setAbhaLinking] = useState(false);

  useEffect(() => {
    setForm(buildForm(user.role, profile, user));
    setIsEditing(false);
    setError("");
  }, [profile, user]);

  const patientSummary = useMemo(() => {
    if (user.role !== "patient") {
      return null;
    }

    return [
      { label: "Allergies", value: form.notes || "None added", icon: Sparkles },
      { label: "Blood group", value: "A+", icon: ShieldCheck },
      { label: "ABHA", value: form.abhaNumber || "Link Health ID", icon: ShieldCheck }
    ];
  }, [form.abhaNumber, form.notes, user.role]);

  const unreadNotificationCount = useMemo(() => {
    const sessionUserId = state?.session?.userId;
    if (!sessionUserId) {
      return 0;
    }

    return (state?.notifications?.allIds || [])
      .map((notificationId) => state.notifications.byId[notificationId])
      .filter((notification) => notification?.userId === sessionUserId && !notification.is_read).length;
  }, [state?.notifications, state?.session?.userId]);

  const displayName = form.fullName?.trim() || profile.fullName || "User";

  function handleStartEditing() {
    setForm(buildForm(user.role, profile, user));
    setSaved(false);
    setError("");
    setActionFeedback("");
    setIsEditing(true);
  }

  function handleCancelEditing() {
    setForm(buildForm(user.role, profile, user));
    setSaved(false);
    setError("");
    setActionFeedback("");
    setIsEditing(false);
  }

  async function handleProfilePhotoChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.type && !file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      event.target.value = "";
      return;
    }

    if (file.size > PROFILE_PHOTO_MAX_SIZE_BYTES) {
      setError("Please keep the profile picture under 2 MB.");
      event.target.value = "";
      return;
    }

    try {
      const profilePhoto = await readFileAsDataUrl(file);
      setForm((current) => ({ ...current, profilePhoto }));
      setSaved(false);
      setError("");
      setActionFeedback("");
    } catch (issue) {
      setError(issue.message);
    } finally {
      event.target.value = "";
    }
  }

  function handleRemoveProfilePhoto() {
    setForm((current) => ({ ...current, profilePhoto: "" }));
    setSaved(false);
    setError("");
    setActionFeedback("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    setActionFeedback("");

    try {
      await actions.auth.updateCurrentProfile(form);
      setSaved(true);
      setIsEditing(false);
    } catch (issue) {
      setError(issue.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleABHALink(abhaId) {
    setAbhaLinking(true);
    try {
      const nextForm = { ...form, abhaNumber: abhaId };
      setForm(nextForm);
      setActionFeedback("");
      await actions.auth.updateCurrentProfile(nextForm);
      setSaved(true);
    } catch (issue) {
      setError(issue.message);
    } finally {
      setAbhaLinking(false);
    }
  }

  async function handleABHAUnlink() {
    setAbhaLinking(true);
    setError("");
    setActionFeedback("");

    try {
      const nextForm = { ...form, abhaNumber: "" };
      setForm(nextForm);
      await actions.auth.updateCurrentProfile(nextForm);
      setSaved(true);
    } catch (issue) {
      setError(issue.message);
    } finally {
      setAbhaLinking(false);
    }
  }

  async function handlePushNotifications() {
    setError("");
    setSaved(false);

    if (typeof window === "undefined" || !("Notification" in window)) {
      setActionFeedback("");
      setError("Push notifications are not supported in this browser.");
      return;
    }

    try {
      const permission = await window.Notification.requestPermission();

      if (permission === "granted") {
        setActionFeedback(
          unreadNotificationCount
            ? `Push notifications are enabled. You currently have ${unreadNotificationCount} unread notification${unreadNotificationCount === 1 ? "" : "s"}.`
            : "Push notifications are enabled for this browser."
        );
        return;
      }

      if (permission === "denied") {
        setActionFeedback("");
        setError("Push notifications are blocked in this browser. Please allow them in your browser settings.");
        return;
      }

      setActionFeedback("Push notification permission is still pending.");
    } catch (issue) {
      setActionFeedback("");
      setError(issue.message || "Unable to update notification access right now.");
    }
  }

  async function handleLogout() {
    setActionFeedback("");
    await actions.auth.logout();
  }

  return (
    <AppShell title={copy[user.role].title} subtitle={copy[user.role].subtitle}>
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
          <Card density="compact">
            <CardHeader eyebrow="Identity" title={profile.fullName} description="Quick identity and trust panel." />
            <div className="flex flex-col items-center text-center">
              <ProfileAvatar
                name={displayName}
                photo={form.profilePhoto}
                size="xl"
                tone="soft"
              />
              <div className="mt-4 text-lg font-semibold text-ink">{displayName}</div>
              <div className="mt-1 text-sm text-muted">{form.phone || user.phone}</div>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Badge tone={isEditing ? "info" : "neutral"}>
                  {isEditing ? "Editing enabled" : "View mode"}
                </Badge>
                {user.role === "patient" ? <Badge tone="info">Patient account</Badge> : null}
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-line bg-surface-2 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-tide">
                Profile picture
              </div>
              <div className="mt-2 text-sm text-muted">
                Preview updates instantly here. Save the profile to persist the photo to the Mongo-backed app
                state when that API is enabled.
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                aria-label="Profile picture upload"
                onChange={handleProfilePhotoChange}
                className="hidden"
                disabled={!isEditing || saving}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!isEditing || saving}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                  {form.profilePhoto ? "Change photo" : "Upload photo"}
                </Button>
                {form.profilePhoto ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!isEditing || saving}
                    onClick={handleRemoveProfilePhoto}
                    className="text-brand-coral hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </div>
              {!isEditing ? (
                <div className="mt-3 text-xs text-muted">Click Edit to update the profile picture.</div>
              ) : null}
            </div>

            {user.role === "patient" ? (
              <div className="mt-5 space-y-3">
                {patientSummary?.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-line bg-surface-2 p-3">
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand-tide">
                      <span className="icon-wrap-soft">
                        <item.icon className="h-3.5 w-3.5 icon-glow" />
                      </span>
                      {item.label}
                    </div>
                    <div className="mt-1.5 text-sm text-ink">{item.value}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {user.role === "patient" ? (
              <div className="mt-5 rounded-2xl border border-brand-mint bg-brand-mint p-4 text-sm text-ink">
                <div className="font-semibold">ABHA</div>
                <div className="mt-1">Link Health ID (India-specific)</div>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader
              eyebrow={isEditing ? "Edit mode" : "Profile overview"}
              title="Profile details"
              description={
                isEditing
                  ? "Make changes now and save when you are ready."
                  : "Review your details here. Click Edit when you want to make changes."
              }
              actions={
                !isEditing ? (
                  <Button type="button" variant="secondary" size="sm" onClick={handleStartEditing}>
                    <PencilLine className="h-4 w-4" />
                    Edit
                  </Button>
                ) : null
              }
            />

            <form className="grid gap-5" onSubmit={handleSubmit}>
              <fieldset className="grid gap-5" disabled={!isEditing || saving}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Full name">
                    <Input
                      value={form.fullName}
                      onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                    />
                  </Field>
                  <Field label="Phone">
                    <Input
                      value={form.phone}
                      onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    />
                  </Field>

                  {user.role === "patient" ? (
                    <>
                      <Field label="Age">
                        <Input
                          value={form.age}
                          onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))}
                        />
                      </Field>
                      <Field label="Gender">
                        <Select
                          value={form.gender}
                          onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                        >
                          <option value="">Prefer not to say</option>
                          <option value="Female">Female</option>
                          <option value="Male">Male</option>
                          <option value="Other">Other</option>
                        </Select>
                      </Field>
                      <Field label="City">
                        <Input
                          value={form.city}
                          onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                        />
                      </Field>
                      <Field label="Emergency contact name">
                        <Input
                          value={form.emergencyContactName}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, emergencyContactName: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Emergency contact phone">
                        <Input
                          value={form.emergencyContactPhone}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, emergencyContactPhone: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Notes" className="md:col-span-2">
                        <Textarea
                          value={form.notes}
                          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                        />
                      </Field>
                    </>
                  ) : null}

                  {user.role === "doctor" ? (
                    <>
                      <Field label="Specialty">
                        <Input
                          value={form.specialty}
                          onChange={(event) => setForm((current) => ({ ...current, specialty: event.target.value }))}
                        />
                      </Field>
                      <Field label="Clinic">
                        <Input
                          value={form.clinic}
                          onChange={(event) => setForm((current) => ({ ...current, clinic: event.target.value }))}
                        />
                      </Field>
                      <Field label="License number">
                        <Input
                          value={form.licenseNumber}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, licenseNumber: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Gender">
                        <Select
                          value={form.gender}
                          onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                        >
                          <option value="">Prefer not to say</option>
                          <option value="Female">Female</option>
                          <option value="Male">Male</option>
                          <option value="Other">Other</option>
                        </Select>
                      </Field>
                      <Field label="Bio" className="md:col-span-2">
                        <Textarea
                          value={form.bio}
                          onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                        />
                      </Field>
                    </>
                  ) : null}

                  {user.role === "nurse" ? (
                    <>
                      <Field label="Nursing license number">
                        <Input
                          value={form.nursingLicenseNumber}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, nursingLicenseNumber: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Department">
                        <Input
                          value={form.department}
                          onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                        />
                      </Field>
                      <Field label="Shift">
                        <Select
                          value={form.shift}
                          onChange={(event) => setForm((current) => ({ ...current, shift: event.target.value }))}
                        >
                          <option value="day">Day</option>
                          <option value="evening">Evening</option>
                          <option value="night">Night</option>
                          <option value="rotational">Rotational</option>
                        </Select>
                      </Field>
                      <Field label="Assigned ward">
                        <Input
                          value={form.assignedWard}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, assignedWard: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Years of experience">
                        <Input
                          type="number"
                          min="0"
                          value={form.yearsExperience}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, yearsExperience: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Emergency contact name">
                        <Input
                          value={form.emergencyContactName}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, emergencyContactName: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Emergency contact phone">
                        <Input
                          value={form.emergencyContactPhone}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, emergencyContactPhone: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Notes" className="md:col-span-2">
                        <Textarea
                          value={form.notes}
                          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                        />
                      </Field>
                    </>
                  ) : null}

                  {user.role === "admin" ? (
                    <Field label="Clinic name">
                      <Input
                        value={form.clinicName}
                        onChange={(event) => setForm((current) => ({ ...current, clinicName: event.target.value }))}
                      />
                    </Field>
                  ) : null}
                </div>
              </fieldset>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={handlePushNotifications}>
                  <Bell className="h-4 w-4" />
                  Push Notifications
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  {error}
                </div>
              ) : null}
              {actionFeedback ? (
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">
                  {actionFeedback}
                </div>
              ) : null}
              {saved ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  Profile saved successfully.
                </div>
              ) : null}

              {isEditing ? (
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? "Saving..." : "Save profile"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleCancelEditing} disabled={saving}>
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
                  Editing stays locked by default. Use the Edit button when you want to update details or your
                  profile picture.
                </div>
              )}
            </form>
          </Card>
        </div>

        {user.role === "patient" ? (
          <ABHALinkingCard
            abhaNumber={form.abhaNumber}
            onLinkClick={handleABHALink}
            onUnlinkClick={handleABHAUnlink}
            loading={abhaLinking}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
