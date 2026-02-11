import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Button } from "./ui/button";
import Image from "next/image";

const Step = ({ className, ...props }: React.ComponentProps<"h3">) => (
  <h3
    className={cn(
      "font-heading mt-8 scroll-m-32 text-lg font-medium tracking-tight",
      className
    )}
    {...props}
  />
)

export function OnboardingStepper({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const t = useTranslations('onboarding');
  const tSettings = useTranslations('settings');
  return (
    <div
      className={cn(
        "[&>h3]:step steps [counter-reset:step] md:ml-4 md:border-l md:pl-8",
        className
      )}
    >
      <Step>{t('step1')}</Step>
      <figure className="max-w-2xl">
        <p className="text-sm text-muted-foreground py-1">{t('step1Description')}</p>
        <Link href="/settings">
          <Button>{tSettings('title')}</Button>
        </Link>
      </figure>
      <Step>{t('step2')}</Step>
      <Step>{t('step3')}</Step>
      <figure className="max-w-2xl">
        <p className="text-sm text-muted-foreground py-1">{t('step3Description')}</p>
        <Image 
          src="/chat-canvas.png"
          alt="Chat with canvas"
          width={1200}
          height={600}
          className="w-full h-auto rounded-lg"
        />
      </figure>
    </div>
  );
}