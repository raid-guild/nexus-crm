import { getAiIntegrationStatus } from "@/lib/ai-config";
import { getSession } from "@/lib/auth-server";
import Container from "../../components/ui/Container";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bot, CheckCircle2, Database, Server, XCircle } from "lucide-react";

function StatusBadge({ state }: { state: "ready" | "missing" | "partial" }) {
  if (state === "ready") {
    return (
      <Badge variant="outline" className="border-green-500 bg-green-500/10 text-green-700">
        Ready
      </Badge>
    );
  }

  if (state === "partial") {
    return (
      <Badge variant="outline" className="border-amber-500 bg-amber-500/10 text-amber-700">
        Partial
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-destructive/60 bg-destructive/10 text-destructive">
      Missing
    </Badge>
  );
}

function BooleanStatus({ value, label }: { value: boolean; label: string }) {
  const Icon = value ? CheckCircle2 : XCircle;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className={value ? "h-4 w-4 text-green-600" : "h-4 w-4 text-muted-foreground"} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

export default async function LlmKeysPage() {
  const session = await getSession();
  const t = await getTranslations("AdminPage");

  if (session?.user?.role !== "admin") {
    return (
      <Container title="AI Integrations" description="Runtime and embedding provider status">
        <div className="flex w-full h-full items-center justify-center">
          {t("accessNotAllowed")}
        </div>
      </Container>
    );
  }

  const status = await getAiIntegrationStatus();

  return (
    <Container
      title="AI Integrations"
      description="Environment-managed providers for vectors, enrichment, and document AI"
    >
      <div className="grid max-w-5xl gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Embeddings</CardTitle>
              </div>
              <StatusBadge state={status.embeddings.state} />
            </div>
            <CardDescription>OpenAI-compatible vector generation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1 text-sm">
              <p className="font-medium">{status.embeddings.provider}</p>
              <p className="break-all font-mono text-xs text-muted-foreground">
                {status.embeddings.baseURL}
              </p>
            </div>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Model</span>
                <span className="text-right font-mono text-xs">{status.embeddings.model}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Dimensions</span>
                <span>{status.embeddings.dimensions}</span>
              </div>
            </div>
            <BooleanStatus value={status.embeddings.apiKeyConfigured} label="API key configured" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Agent Runtime</CardTitle>
              </div>
              <StatusBadge state={status.agentRuntime.state} />
            </div>
            <CardDescription>Prism Codex Runtime for enrichment flows</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1 text-sm">
              <p className="font-medium">{status.agentRuntime.provider}</p>
              <p className="break-all font-mono text-xs text-muted-foreground">
                {status.agentRuntime.url ?? "PRISM_CODEX_RUNTIME_URL not set"}
              </p>
            </div>
            <div className="grid gap-2">
              <BooleanStatus value={status.agentRuntime.urlConfigured} label="Runtime URL configured" />
              <BooleanStatus value={status.agentRuntime.tokenConfigured} label="Auth token configured" />
              <div className="flex items-center gap-2 text-sm">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Health:</span>
                <span className="capitalize">{status.agentRuntime.health.replace("_", " ")}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Document AI</CardTitle>
              </div>
              <StatusBadge state={status.documentAi.state} />
            </div>
            <CardDescription>Summary and document classification model</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1 text-sm">
              <p className="font-medium">{status.documentAi.provider}</p>
            </div>
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Chat model</span>
              <span className="text-right font-mono text-xs">{status.documentAi.model}</span>
            </div>
            {status.documentAi.provider === "prism" ? (
              <div className="grid gap-2">
                <BooleanStatus value={status.documentAi.agentApiConfigured} label="Agent API configured" />
                <BooleanStatus value={status.documentAi.memoryApiConfigured} label="Memory API configured" />
                <p className="text-sm text-muted-foreground">
                  Sends extracted CRM document text to Prism Memory and the crm-document-uploaded hook.
                </p>
              </div>
            ) : status.documentAi.provider === "prism-codex" ? (
              <div className="grid gap-2">
                <BooleanStatus value={status.documentAi.runtimeUrlConfigured} label="Runtime URL configured" />
                <BooleanStatus value={status.documentAi.runtimeTokenConfigured} label="Auth token configured" />
                <div className="flex items-center gap-2 text-sm">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Health:</span>
                  <span className="capitalize">{status.documentAi.health.replace("_", " ")}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Uses the OpenAI-compatible endpoint and API key.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
