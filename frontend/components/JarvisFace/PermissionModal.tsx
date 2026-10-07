export type PendingAction = {
  action?: string;
  target?: string;
  required_level?: string;
  message?: string;
  status?: string;
  prompt?: {
    title?: string;
    action?: string;
    target?: string;
    message?: string;
  };
  originalAction?: string;
  originalParams?: Record<string, unknown>;
};

type PermissionModalProps = {
  pendingAction: PendingAction | null;
  onAllowOnce: () => void;
  onDeny: () => void;
};

export default function PermissionModal({
  pendingAction,
  onAllowOnce,
  onDeny,
}: PermissionModalProps) {
  if (!pendingAction) return null;

  const actionName = pendingAction.action || pendingAction.originalAction || "Protected action";
  const targetName = pendingAction.target || "system target";
  const permissionLevel = pendingAction.required_level || "CONFIRMATION_REQUIRED";
  const message =
    pendingAction.message ||
    pendingAction.prompt?.message ||
    "This action requires explicit permission before it can run.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-cyan-400/40 bg-slate-900/95 p-6 shadow-[0_0_30px_rgba(34,211,238,0.25)]">
        <div className="mb-5 flex items-center justify-between border-b border-cyan-500/20 pb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">JARVIS Security</p>
            <h2 className="mt-2 text-2xl font-semibold text-cyan-100">Permission Required</h2>
          </div>
          <div className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
            {permissionLevel}
          </div>
        </div>

        <div className="space-y-4 text-sm text-slate-200">
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <span className="text-slate-400">Action</span>
            <span className="font-medium text-cyan-100">{actionName}</span>
          </div>

          <div className="grid grid-cols-[140px_1fr] gap-2">
            <span className="text-slate-400">Target</span>
            <span className="font-medium text-cyan-100">{targetName}</span>
          </div>

          <div className="grid grid-cols-[140px_1fr] gap-2">
            <span className="text-slate-400">Permission</span>
            <span className="font-medium text-amber-300">{permissionLevel}</span>
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-slate-950/60 p-4 text-slate-200">
            <span className="block text-xs uppercase tracking-[0.2em] text-cyan-300">Message</span>
            <p className="mt-2 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onDeny}
            className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-red-400 hover:text-red-200"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={onAllowOnce}
            className="rounded-lg border border-cyan-400 bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Allow Once
          </button>
        </div>
      </div>
    </div>
  );
}
