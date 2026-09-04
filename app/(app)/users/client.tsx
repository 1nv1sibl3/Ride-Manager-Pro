"use client";
import { useState, useTransition } from "react";
import { Plus, Pencil, User as UserIcon, ShieldCheck, UserCog, UserCircle } from "lucide-react";
import { createUser, updateUser, updateOwnProfile } from "./actions";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { toastResult } from "@/components/ui/toast";
import { inr } from "@/lib/pricing";
import { fmtDateShort } from "@/lib/utils";

type Role = "owner" | "staff" | "manager";
type U = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: Role;
  active: boolean;
  createdAt: string;
  bookingsAll: number;
  bookingsMonth: number;
  paymentsAll: number;
  paymentsMonthSum: number;
  lastActive: string | null;
};

const ROLES: Role[] = ["staff", "owner", "manager"];

function roleBadge(r: Role) {
  if (r === "owner") return { cls: "badge-warn", icon: ShieldCheck };
  if (r === "manager") return { cls: "badge-info", icon: UserCog };
  return { cls: "badge-success", icon: UserIcon };
}

export function UsersClient({
  users, currentUserId, currentRole,
}: { users: U[]; currentUserId: string; currentRole: Role }) {
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<U | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  const me = users.find((u) => u.id === currentUserId);
  const filtered = users.filter((u) =>
    !q || `${u.username} ${u.fullName} ${u.email ?? ""} ${u.phone ?? ""} ${u.role}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">
          Users <span className="text-sm font-normal text-muted">({users.length})</span>
        </h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setShowProfile(true)}>
            <UserCircle size={14} /> My profile
          </Button>
          <Button variant="primary" onClick={() => setShowNew(true)}>
            <Plus size={14} /> Add user
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input className="max-w-xs" placeholder="Search name / username / email / phone"
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="t">
          <thead>
            <tr>
              <th>Name</th><th>Username</th><th>Email</th><th>Phone</th><th>Role</th>
              <th className="text-right">Bookings</th><th className="text-right">Payments (mo)</th>
              <th>Last active</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const rb = roleBadge(u.role);
              const Icon = rb.icon;
              return (
                <tr key={u.id}>
                  <td>
                    {u.fullName}
                    {u.id === currentUserId && <span className="text-xs ml-2 text-muted">(you)</span>}
                  </td>
                  <td className="font-mono text-xs">{u.username}</td>
                  <td className="text-xs">{u.email ?? "—"}</td>
                  <td className="text-xs">{u.phone ?? "—"}</td>
                  <td>
                    <span className={`badge ${rb.cls} inline-flex items-center gap-1`}>
                      <Icon size={11} /> {u.role}
                    </span>
                  </td>
                  <td className="text-right num text-xs">
                    {u.bookingsAll}
                    {u.bookingsMonth > 0 && <span className="text-muted"> · {u.bookingsMonth} mo</span>}
                  </td>
                  <td className="text-right num text-xs">
                    {u.paymentsMonthSum > 0 ? inr(u.paymentsMonthSum) : "—"}
                    {u.paymentsMonthSum > 0 && <span className="text-muted"> · {u.paymentsAll} all</span>}
                  </td>
                  <td className="text-xs text-muted">{u.lastActive ? fmtDateShort(u.lastActive) : "never"}</td>
                  <td>
                    <span className={`badge ${u.active ? "badge-success" : "badge-neutral"}`}>
                      {u.active ? "active" : "disabled"}
                    </span>
                  </td>
                  <td>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>
                      <Pencil size={12} /> Edit
                    </Button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="text-center py-8 text-muted">No users</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showNew && <UserForm mode="create" currentRole={currentRole} onClose={() => setShowNew(false)} />}
      {editing && (
        <UserForm mode="edit" initial={editing} currentRole={currentRole} currentUserId={currentUserId}
          onClose={() => setEditing(null)} />
      )}
      {showProfile && me && <ProfileForm me={me} onClose={() => setShowProfile(false)} />}
    </div>
  );
}

function UserForm({
  mode, initial, currentRole, currentUserId, onClose,
}: {
  mode: "create" | "edit";
  initial?: U;
  currentRole: Role;
  currentUserId?: string;
  onClose: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isSelf = mode === "edit" && initial?.id === currentUserId;
  const canChangeRole = !isSelf && (currentRole === "owner" || (currentRole === "manager" && initial?.role !== "owner"));
  const availableRoles: Role[] = currentRole === "owner" ? ROLES : ROLES.filter((r) => r !== "owner");

  return (
    <Dialog open onClose={onClose} title={mode === "create" ? "Add user" : `Edit ${initial?.username}`}>
      <form
        className="space-y-3"
        action={(fd) => {
          setErr(null);
          start(async () => {
            const res = mode === "create" ? await createUser(fd) : await updateUser(fd);
            if (res?.error) setErr(res.error);
            else {
              toastResult(res, mode === "create" ? "User created" : "User updated");
              onClose();
            }
          });
        }}
      >
        {mode === "edit" && <input type="hidden" name="id" value={initial!.id} />}

        {mode === "create" && (
          <Field label="Username" required>
            <Input name="username" required minLength={3} maxLength={40}
              placeholder="e.g. ramesh" autoComplete="off" />
          </Field>
        )}

        <Field label="Full name" required>
          <Input name="fullName" required maxLength={120} defaultValue={initial?.fullName ?? ""} />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Email">
            <Input name="email" type="email" maxLength={160} defaultValue={initial?.email ?? ""} />
          </Field>
          <Field label="Phone">
            <Input name="phone" maxLength={40} defaultValue={initial?.phone ?? ""} />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Role">
            <Select name="role"
              defaultValue={initial?.role ?? "staff"}
              disabled={mode === "edit" && !canChangeRole}>
              {availableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label={mode === "create" ? "Password" : "New password (leave blank to keep)"}>
            <Input name="password" type="password" minLength={6} maxLength={200}
              required={mode === "create"} autoComplete="new-password" />
          </Field>
        </div>

        {!isSelf && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} />
            Active
          </label>
        )}

        {err && <div className="text-sm text-danger">{err}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={pending}>
            {mode === "create" ? "Create" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ProfileForm({ me, onClose }: { me: U; onClose: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open onClose={onClose} title="My profile">
      <form
        className="space-y-3"
        action={(fd) => {
          setErr(null);
          start(async () => {
            const res = await updateOwnProfile(fd);
            if (res?.error) setErr(res.error);
            else {
              toastResult(res, "Profile updated");
              onClose();
            }
          });
        }}
      >
        <Field label="Username">
          <Input value={me.username} disabled />
        </Field>
        <Field label="Full name" required>
          <Input name="fullName" required maxLength={120} defaultValue={me.fullName} />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Email">
            <Input name="email" type="email" maxLength={160} defaultValue={me.email ?? ""} />
          </Field>
          <Field label="Phone">
            <Input name="phone" maxLength={40} defaultValue={me.phone ?? ""} />
          </Field>
        </div>
        <Field label="New password (leave blank to keep)">
          <Input name="password" type="password" minLength={6} maxLength={200} autoComplete="new-password" />
        </Field>
        {err && <div className="text-sm text-danger">{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={pending}>Save</Button>
        </div>
      </form>
    </Dialog>
  );
}
