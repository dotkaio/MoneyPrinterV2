import {
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  GalleryVerticalEndIcon,
  Loader2Icon,
  MailIcon,
  MegaphoneIcon,
  SparklesIcon,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useCreations } from "@/hooks/use-creations";
import { useProviders } from "@/hooks/use-providers";
import { cn } from "@/lib/utils";
import type { ContentCreationDto } from "../../dashboard-contract";

const formatOptions = [
  {
    value: "short-video",
    label: "Short video",
    detail: "45-60 second vertical script",
    icon: GalleryVerticalEndIcon,
  },
  {
    value: "social-post",
    label: "Social post",
    detail: "High-signal feed content",
    icon: FileTextIcon,
  },
  {
    value: "newsletter",
    label: "Newsletter",
    detail: "Structured long-form edition",
    icon: MailIcon,
  },
  {
    value: "ad-copy",
    label: "Ad copy",
    detail: "Value prop and clear CTA",
    icon: MegaphoneIcon,
  },
] as const;

export function CreatePage() {
  const { create } = useCreations();
  const { activeProvider } = useProviders();
  const [format, setFormat] =
    useState<ContentCreationDto["format"]>("short-video");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("General audience");
  const [tone, setTone] = useState("Clear and engaging");
  const [language, setLanguage] = useState("English");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creation, setCreation] = useState<ContentCreationDto | null>(null);
  const [copied, setCopied] = useState<"script" | "caption" | null>(null);

  const submit = async (): Promise<void> => {
    setGenerating(true);
    setError(null);
    try {
      setCreation(await create({ format, topic, audience, tone, language }));
      setCopied(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setGenerating(false);
    }
  };

  const copy = async (
    field: "script" | "caption",
    value: string,
  ): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Content studio"
        title="Create"
        description="Turn one idea into publication-ready content. Every result is saved locally in your library."
        actions={
          activeProvider === null ? undefined : (
            <Badge variant="outline" className="h-7 px-3">
              <SparklesIcon data-icon="inline-start" />
              {activeProvider.name} · {activeProvider.model}
            </Badge>
          )
        }
      />

      {error !== null && (
        <Alert variant="destructive">
          <SparklesIcon />
          <AlertTitle>Generation failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <Card>
          <CardHeader>
            <CardTitle>Creative brief</CardTitle>
            <CardDescription>
              Give the model enough direction to make the first draft useful.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-6"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Format</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {formatOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={format === option.value}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        format === option.value &&
                          "border-foreground bg-muted/60",
                      )}
                      onClick={() => setFormat(option.value)}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <option.icon className="size-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-medium">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {option.detail}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="block space-y-2 text-sm font-medium">
                <span>What should this be about?</span>
                <Textarea
                  className="min-h-32"
                  placeholder="Example: Explain why local-first software is becoming the default for privacy-conscious teams."
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  required
                  minLength={3}
                  maxLength={500}
                />
                <span className="block text-right text-xs font-normal text-muted-foreground">
                  {topic.length} / 500
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  <span>Audience</span>
                  <Input
                    className="h-9"
                    value={audience}
                    onChange={(event) => setAudience(event.target.value)}
                    required
                  />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  <span>Tone</span>
                  <Input
                    className="h-9"
                    value={tone}
                    onChange={(event) => setTone(event.target.value)}
                    required
                  />
                </label>
              </div>

              <label className="block space-y-2 text-sm font-medium">
                <span>Language</span>
                <Input
                  className="h-9"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  required
                />
              </label>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={generating || topic.trim().length < 3}
              >
                {generating ? (
                  <Loader2Icon
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <SparklesIcon data-icon="inline-start" />
                )}
                {generating ? "Creating your draft…" : "Generate content"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="min-h-[38rem]">
          {creation === null ? (
            <CardContent className="flex min-h-[34rem] flex-col items-center justify-center text-center">
              <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <SparklesIcon className="size-5" />
              </span>
              <h2 className="font-heading text-lg font-medium">
                Your draft will appear here
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Choose a format, describe the idea, and MoneyPrinter will save a
                complete result to your local library.
              </p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b pb-4">
                <Badge variant="secondary" className="mb-2">
                  {formatOptions.find(
                    (option) => option.value === creation.format,
                  )?.label ?? creation.format}
                </Badge>
                <CardTitle className="text-xl">{creation.title}</CardTitle>
                <CardDescription>{creation.hook}</CardDescription>
                <CardAction>
                  <Badge variant="outline">
                    <CheckIcon data-icon="inline-start" />
                    Saved
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-5">
                <section>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium">Draft</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void copy("script", creation.script)}
                    >
                      {copied === "script" ? (
                        <CheckIcon data-icon="inline-start" />
                      ) : (
                        <CopyIcon data-icon="inline-start" />
                      )}
                      {copied === "script" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <div className="max-h-80 overflow-y-auto rounded-xl bg-muted/50 p-4 text-sm leading-7 whitespace-pre-wrap">
                    {creation.script}
                  </div>
                </section>
                <Separator />
                <section>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium">Caption</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void copy("caption", creation.caption)}
                    >
                      {copied === "caption" ? (
                        <CheckIcon data-icon="inline-start" />
                      ) : (
                        <CopyIcon data-icon="inline-start" />
                      )}
                      {copied === "caption" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
                    {creation.caption}
                  </p>
                </section>
                <div className="flex flex-wrap gap-2">
                  {creation.hashtags.map((hashtag) => (
                    <Badge key={hashtag} variant="outline">
                      #{hashtag}
                    </Badge>
                  ))}
                </div>
                <Separator />
                <div className="flex flex-wrap items-center gap-3">
                  <p className="mr-auto text-xs text-muted-foreground">
                    Generated with {creation.model} in{" "}
                    {Math.round(creation.durationMs)}ms
                  </p>
                  <Button variant="outline" asChild>
                    <Link to="/library">
                      Open library
                      <ArrowRightIcon data-icon="inline-end" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
