import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Lightbulb,
  BookMarked,
  Code2,
  ChevronDown,
  Copy,
  Check,
} from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';

export function NotesPanel() {
  const { notesData } = useCanvasStore();
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['summary', 'key_points'])
  );

  if (!notesData) return null;

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    setExpandedSections(next);
  };

  const copyAll = () => {
    const text = [
      `# ${notesData.title}`,
      `Topic: ${notesData.topic}\n`,
      `## Summary`,
      notesData.summary,
      `\n## Key Points`,
      ...notesData.key_points.map((p, i) => `${i + 1}. ${p}`),
      ...(notesData.definitions.length
        ? [
            `\n## Definitions`,
            ...notesData.definitions.map(
              (d) => `- **${d.term}**: ${d.definition}`
            ),
          ]
        : []),
      ...(notesData.examples.length
        ? [`\n## Examples`, ...notesData.examples.map((e, i) => `${i + 1}. ${e}`)]
        : []),
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sections = [
    {
      id: 'summary',
      icon: BookOpen,
      title: 'Summary',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      content: (
        <p className="text-sm leading-relaxed text-foreground/80">
          {notesData.summary}
        </p>
      ),
    },
    {
      id: 'key_points',
      icon: Lightbulb,
      title: 'Key Points',
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      count: notesData.key_points.length,
      content: (
        <ul className="space-y-2">
          {notesData.key_points.map((point, idx) => (
            <motion.li
              key={idx}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-start gap-2.5 text-sm"
            >
              <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-primary">
                  {idx + 1}
                </span>
              </span>
              <span className="text-foreground/80 leading-relaxed">{point}</span>
            </motion.li>
          ))}
        </ul>
      ),
    },
    ...(notesData.definitions.length > 0
      ? [
          {
            id: 'definitions',
            icon: BookMarked,
            title: 'Definitions',
            color: 'text-violet-500',
            bg: 'bg-violet-500/10',
            count: notesData.definitions.length,
            content: (
              <div className="space-y-3">
                {notesData.definitions.map((def, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="rounded-lg bg-secondary/40 border border-border/30 p-3"
                  >
                    <dt className="text-xs font-semibold text-primary">
                      {def.term}
                    </dt>
                    <dd className="text-xs text-foreground/70 mt-1 leading-relaxed">
                      {def.definition}
                    </dd>
                  </motion.div>
                ))}
              </div>
            ),
          },
        ]
      : []),
    ...(notesData.examples.length > 0
      ? [
          {
            id: 'examples',
            icon: Code2,
            title: 'Examples',
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            count: notesData.examples.length,
            content: (
              <div className="space-y-2">
                {notesData.examples.map((example, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="px-3 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-xs leading-relaxed text-foreground/80"
                  >
                    {example}
                  </motion.div>
                ))}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{notesData.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {notesData.topic}
          </p>
        </div>
        <button
          onClick={copyAll}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title="Copy all notes"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const Icon = section.icon;

          return (
            <div
              key={section.id}
              className="rounded-xl border border-border/40 overflow-hidden"
            >
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-secondary/40 transition-colors"
              >
                <div
                  className={`w-7 h-7 rounded-lg ${section.bg} flex items-center justify-center flex-shrink-0`}
                >
                  <Icon className={`w-3.5 h-3.5 ${section.color}`} />
                </div>
                <span className="text-xs font-medium flex-1 text-left">
                  {section.title}
                </span>
                {'count' in section && (
                  <span className="text-[10px] text-muted-foreground">
                    {section.count}
                  </span>
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="px-3 pb-3 overflow-hidden"
                >
                  {section.content}
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
