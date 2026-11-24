import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Building,
  ArrowRight,
  ArrowLeft,
  FileText,
  Download,
  Share2,
  Loader2,
} from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.js';
import { PageBanner } from '../components/PageBanner.js';
import { ShareButtons } from '../components/ShareButtons.js';
import { CountdownTimer } from '../components/CountdownTimer.js';
import { formatDate } from '../utils/formatDate.js';
import { api, Announcement } from '../lib/ophea-api-client.js';
import { fallbackAnnouncements } from '../data/fallbackContent.js';

export const UpdateDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t, language, isRtl } = useTranslation();
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  const [item, setItem] = useState<any>(() =>
    fallbackAnnouncements.find((a) => a.slug === slug || a.id === slug) || null
  );
  const [loading, setLoading] = useState(!item);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    api
      .getAnnouncement(slug)
      .then((data) => {
        if (mounted && data) {
          setItem(data);
        }
      })
      .catch(() => {
        // keep fallback if available
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-24 px-4 text-center flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-800" />
        <p className="text-xs text-stone-500">Loading announcement...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="max-w-3xl mx-auto py-24 px-4 text-center">
        <h2 className="text-2xl font-bold mb-4">{t('update.notFound')}</h2>
        <p className="text-stone-500 mb-6">
          {t('update.notFoundDesc')}
        </p>
        <Link
          to="/updates"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-800 text-white font-semibold text-sm"
        >
          {t('update.backToUpdates')}
        </Link>
      </div>
    );
  }

  const title = typeof item.title === 'string' ? item.title : (item.title?.[language] || item.title?.en || '');
  const summary = typeof item.summary === 'string' ? item.summary : (item.summary?.[language] || item.summary?.en || '');
  const body = typeof item.body === 'string' ? item.body : (item.body?.[language] || item.body?.en || '');

  const typeLabel =
    item.type === 'news'
      ? t('nav.news')
      : item.type === 'event'
      ? t('nav.events')
      : item.type === 'vacancy'
      ? t('nav.vacancies')
      : item.type === 'proposal' || item.type === 'call_for_proposal'
      ? t('nav.callsProposals')
      : t('nav.callsResearch');

  return (
    <div className="space-y-12 pb-16">
      <PageBanner
        title={title}
        subtitle={summary}
        breadcrumbs={[
          { label: t('nav.home'), to: '/' },
          { label: t('nav.updates'), to: '/updates' },
          { label: typeLabel },
        ]}
      />

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-6 sm:p-10 shadow-sm text-start space-y-8">
          {/* Metadata Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-stone-100 dark:border-stone-800 text-xs">
            <div className="flex flex-wrap items-center gap-3 text-stone-500 dark:text-stone-400">
              <span className="px-3 py-1 rounded-full font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-amber-400">
                {typeLabel}
              </span>
              {item.publishedAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(item.publishedAt, language)}
                </span>
              )}
              {item.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {item.location}
                </span>
              )}
              {item.organizationName && (
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" />
                  {item.organizationName}
                </span>
              )}
            </div>

            <ShareButtons title={title} />
          </div>

          {/* Event Countdown if applicable */}
          {item.type === 'event' && item.eventStartAt && (
            <div className="p-6 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200/80 dark:border-stone-700/80">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    {t('update.eventCountdown')}
                  </h4>
                  <p className="text-xs text-stone-500">
                    {t('update.starts')}: {new Date(item.eventStartAt).toLocaleString()}
                  </p>
                </div>
                <CountdownTimer targetDateString={item.eventStartAt} />
              </div>
            </div>
          )}

          {/* Deadline if vacancy or call */}
          {item.deadline && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
              <span className="font-semibold">
                {t('update.deadline')}: {formatDate(item.deadline, language)}
              </span>
              <span className="font-bold uppercase tracking-wider text-[11px] bg-amber-200 dark:bg-amber-900/60 px-2 py-0.5 rounded">
                {t('common.open')}
              </span>
            </div>
          )}

          {/* Cover image */}
          {([item.coverImageUrl, item.coverImage].some((value) => typeof value === 'string' && value.trim().length > 0)) && (
            <img
              src={[item.coverImageUrl, item.coverImage].find((value) => typeof value === 'string' && value.trim().length > 0)!}
              alt={title}
              className="w-full max-h-96 object-cover rounded-2xl border border-stone-200 dark:border-stone-800"
              loading="lazy"
            />
          )}

          {/* Summary Lead */}
          {summary && (
            <p className="text-base sm:text-lg font-medium text-stone-800 dark:text-stone-200 leading-relaxed border-l-4 border-amber-500 pl-4">
              {summary}
            </p>
          )}

          {/* Main Body */}
          <div className="prose dark:prose-invert max-w-none text-stone-700 dark:text-stone-300 text-sm sm:text-base leading-relaxed space-y-4">
            <p className="whitespace-pre-line">{body}</p>
          </div>

          {(item.attachmentUrl || item.externalLink) && (
            <div className="flex flex-wrap gap-3">
              {item.attachmentUrl && (
                <a
                  href={item.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
                >
                  Download attachment
                </a>
              )}
              {item.externalLink && (
                <a
                  href={item.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
                >
                  More information
                </a>
              )}
            </div>
          )}

          {/* Actions & Next Steps */}
          <div className="pt-8 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-4">
            <Link
              to="/updates"
              className="inline-flex items-center gap-2 text-xs font-bold text-stone-600 dark:text-stone-400 hover:text-emerald-800 dark:hover:text-amber-400"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              <span>{t('update.backToUpdates')}</span>
            </Link>

            {item.registrationOpen && (
              item.registrationUrl ? (
                <a
                  href={item.registrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md transition"
                >
                  <span>{t('update.applyOnline')}</span>
                  <ArrowIcon className="w-4 h-4" />
                </a>
              ) : (
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md transition"
                >
                  <span>{t('update.applyOnline')}</span>
                  <ArrowIcon className="w-4 h-4" />
                </Link>
              )
            )}
          </div>
        </div>
      </article>
    </div>
  );
};
