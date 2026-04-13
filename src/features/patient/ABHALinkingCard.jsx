import { useState } from "react";
import { Link as LinkIcon, Unlink2, Check, Shield, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/FormFields";

/**
 * ABHALinkingCard - Dedicated component for ABHA account linking
 * Shows status, allows linking/unlinking, and displays linked account details
 */
export function ABHALinkingCard({ abhaNumber, onLinkClick, onUnlinkClick, loading = false }) {
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkInput, setLinkInput] = useState(abhaNumber || "");
  const isLinked = Boolean(abhaNumber);

  const handleLinkSubmit = () => {
    if (linkInput.trim() && linkInput.length >= 10) {
      onLinkClick?.(linkInput);
      setShowLinkForm(false);
    }
  };

  const handleUnlink = () => {
    if (window.confirm("Are you sure you want to unlink your ABHA account?")) {
      onUnlinkClick?.();
      setLinkInput("");
      setShowLinkForm(false);
    }
  };

  return (
    <div style={{ 
      border: "3px solid #16a34a", 
      backgroundColor: "#f0fdf4", 
      borderRadius: "16px", 
      padding: "20px",
      marginTop: "20px",
      display: "block",
      visibility: "visible"
    }}>
      <div style={{ marginBottom: "16px" }}>
        <p style={{ fontSize: "12px", fontWeight: "700", color: "#0ea5e9", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
          Health Account
        </p>
        <h3 style={{ fontSize: "20px", fontWeight: "600", color: "#000", margin: "0" }}>ABHA Linking</h3>
        <p style={{ fontSize: "14px", color: "#666", marginTop: "4px", margin: "4px 0 0 0" }}>Link your Ayushman Bharat Health Account for unified health records</p>
      </div>
      
      <div className="space-y-4 p-4 pt-0">
        {/* Status Panel */}
        <div className="rounded-2xl border border-line bg-surface-2 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isLinked ? "bg-brand-mint" : "bg-amber-100"}`}>
                {isLinked ? (
                  <Check className="h-5 w-5 text-brand-tide" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-700" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{isLinked ? "ABHA Account Linked" : "ABHA Account Not Linked"}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {isLinked 
                    ? "Your health records are now accessible across providers" 
                    : "Link your account to access unified health records"}
                </p>
              </div>
            </div>
            <Badge tone={isLinked ? "success" : "info"}>{isLinked ? "Active" : "Pending"}</Badge>
          </div>
        </div>

        {/* Linked Account Details */}
        {isLinked && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 flex-shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-900">ABHA ID</p>
                  <p className="mt-1 text-sm font-mono text-emerald-800">{abhaNumber}</p>
                  <p className="mt-2 text-xs text-emerald-700">
                    Your ABHA account is active. All your health records are now linked to this account.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => setShowLinkForm(!showLinkForm)}
                disabled={loading}
              >
                <LinkIcon className="h-4 w-4" />
                Update ABHA
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleUnlink}
                disabled={loading}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              >
                <Unlink2 className="h-4 w-4" />
                Unlink
              </Button>
            </div>
          </div>
        )}

        {/* Linking Form */}
        {!isLinked || showLinkForm ? (
          <div className="space-y-3 rounded-2xl border-2 border-dashed border-brand-tide bg-brand-mint/10 p-4">
            <div>
              <p className="text-sm font-semibold text-ink">Link Your ABHA Account</p>
              <p className="mt-1 text-xs text-muted">
                Enter your 14-digit ABHA number (or mobile number registered with ABHA)
              </p>
            </div>

            <Field label="ABHA Number">
              <Input
                type="text"
                placeholder="Enter 14-digit ABHA ID"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value.toUpperCase())}
                maxLength="20"
                disabled={loading}
              />
            </Field>

            <div className="flex gap-2">
              <Button 
                onClick={handleLinkSubmit}
                disabled={loading || !linkInput.trim()}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Linking...
                  </>
                ) : (
                  <>
                    <LinkIcon className="h-4 w-4" />
                    Link ABHA
                  </>
                )}
              </Button>
              {showLinkForm && (
                <Button 
                  variant="secondary"
                  onClick={() => {
                    setShowLinkForm(false);
                    setLinkInput(abhaNumber || "");
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              )}
            </div>

            <div className="rounded-xl bg-blue-50 p-3">
              <p className="text-xs text-blue-900">
                💡 <strong>Tip:</strong> Don't have an ABHA ID? Visit <a href="https://abha.abdm.gov.in" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-700">abha.abdm.gov.in</a> to create one in 2 minutes.
              </p>
            </div>
          </div>
        ) : null}

        {/* Benefits Section */}
        <div className="space-y-2 rounded-xl border border-brand-tide/20 bg-brand-tide/5 p-3">
          <p className="text-xs font-semibold text-ink">Benefits of ABHA Linking:</p>
          <ul className="space-y-1 text-xs text-muted">
            <li>✓ Centralized health records</li>
            <li>✓ Easy sharing with authorized providers</li>
            <li>✓ Better continuity of care</li>
            <li>✓ Government health scheme eligibility</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
