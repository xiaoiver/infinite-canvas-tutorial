'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCcw } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import Canvas from '@/components/canvas';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Pen, SerializedNode, Task } from '@infinite-canvas-tutorial/ecs';

type TeamId = 'portugal';
type FormationId = '4-4-2' | '4-3-3' | '3-5-2';

type Player = {
  name: string;
  number: number;
  position: string;
};

type FormationRow = {
  label: string;
  players: Player[];
};

const TEAM_IDS: TeamId[] = ['portugal'];
const FORMATION_IDS: FormationId[] = ['4-4-2', '4-3-3', '3-5-2'];

const PORTUGAL_FORMATIONS: Record<FormationId, FormationRow[]> = {
  '4-4-2': [
    {
      label: 'FW',
      players: [
        { name: 'Cristiano Ronaldo', number: 7, position: 'ST' },
        { name: 'Rafael Leão', number: 17, position: 'ST' },
      ],
    },
    {
      label: 'MF',
      players: [
        { name: 'Bruno Fernandes', number: 8, position: 'LM' },
        { name: 'Vitinha', number: 23, position: 'CM' },
        { name: 'João Palhinha', number: 6, position: 'CM' },
        { name: 'Bernardo Silva', number: 10, position: 'RM' },
      ],
    },
    {
      label: 'DF',
      players: [
        { name: 'Nuno Mendes', number: 19, position: 'LB' },
        { name: 'Rúben Dias', number: 4, position: 'CB' },
        { name: 'Pepe', number: 3, position: 'CB' },
        { name: 'João Cancelo', number: 20, position: 'RB' },
      ],
    },
    {
      label: 'GK',
      players: [{ name: 'Diogo Costa', number: 22, position: 'GK' }],
    },
  ],
  '4-3-3': [
    {
      label: 'FW',
      players: [
        { name: 'Rafael Leão', number: 17, position: 'LW' },
        { name: 'Cristiano Ronaldo', number: 7, position: 'ST' },
        { name: 'Bernardo Silva', number: 10, position: 'RW' },
      ],
    },
    {
      label: 'MF',
      players: [
        { name: 'Bruno Fernandes', number: 8, position: 'CM' },
        { name: 'João Palhinha', number: 6, position: 'DM' },
        { name: 'Vitinha', number: 23, position: 'CM' },
      ],
    },
    {
      label: 'DF',
      players: [
        { name: 'Nuno Mendes', number: 19, position: 'LB' },
        { name: 'Rúben Dias', number: 4, position: 'CB' },
        { name: 'Pepe', number: 3, position: 'CB' },
        { name: 'João Cancelo', number: 20, position: 'RB' },
      ],
    },
    {
      label: 'GK',
      players: [{ name: 'Diogo Costa', number: 22, position: 'GK' }],
    },
  ],
  '3-5-2': [
    {
      label: 'FW',
      players: [
        { name: 'Cristiano Ronaldo', number: 7, position: 'ST' },
        { name: 'Gonçalo Ramos', number: 9, position: 'ST' },
      ],
    },
    {
      label: 'MF',
      players: [
        { name: 'Nuno Mendes', number: 19, position: 'LWB' },
        { name: 'Bruno Fernandes', number: 8, position: 'CM' },
        { name: 'João Palhinha', number: 6, position: 'DM' },
        { name: 'Vitinha', number: 23, position: 'CM' },
        { name: 'João Cancelo', number: 20, position: 'RWB' },
      ],
    },
    {
      label: 'DF',
      players: [
        { name: 'Gonçalo Inácio', number: 14, position: 'CB' },
        { name: 'Rúben Dias', number: 4, position: 'CB' },
        { name: 'Pepe', number: 3, position: 'CB' },
      ],
    },
    {
      label: 'GK',
      players: [{ name: 'Diogo Costa', number: 22, position: 'GK' }],
    },
  ],
};

const TEAM_FORMATIONS: Record<TeamId, Record<FormationId, FormationRow[]>> = {
  portugal: PORTUGAL_FORMATIONS,
};

const PITCH = {
  x: 80,
  y: 80,
  width: 1280,
  height: 820,
};

const colors = {
  pitch: '#176B3A',
  pitchLight: '#23834A',
  line: '#E7F8EF',
  card: '#FFFFFF',
  cardStroke: '#BFDCCB',
  portugalRed: '#D00027',
  portugalGreen: '#006600',
  text: '#132318',
  muted: '#51635A',
};

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function avatarDataUrl(player: Player) {
  const text = initials(player.name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${colors.portugalGreen}"/>
        <stop offset="0.48" stop-color="${colors.portugalGreen}"/>
        <stop offset="0.5" stop-color="${colors.portugalRed}"/>
        <stop offset="1" stop-color="${colors.portugalRed}"/>
      </linearGradient>
    </defs>
    <rect width="160" height="160" rx="80" fill="url(#g)"/>
    <circle cx="80" cy="80" r="54" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.65)" stroke-width="6"/>
    <text x="80" y="92" text-anchor="middle" font-family="system-ui, sans-serif" font-size="46" font-weight="700" fill="#fff">${text}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function textNode(
  id: string,
  content: string,
  anchorX: number,
  anchorY: number,
  fontSize: number,
  zIndex: number,
  color = colors.text,
): SerializedNode {
  return {
    id,
    type: 'text',
    anchorX,
    anchorY,
    content,
    fontFamily: 'system-ui',
    fontSize,
    fills: [{ type: 'solid', value: color, opacity: 1 }],
    zIndex,
  };
}

function buildPitchNodes(tItem: (key: string) => string): SerializedNode[] {
  return [
    {
      id: 'formation-pitch',
      type: 'rect',
      name: tItem('pitchLabel'),
      x: PITCH.x,
      y: PITCH.y,
      width: PITCH.width,
      height: PITCH.height,
      cornerRadius: 28,
      fills: [{ type: 'solid', value: colors.pitch, opacity: 1 }],
      strokes: [{ type: 'solid', value: colors.line, opacity: 1 }],
      strokeWidth: 6,
      zIndex: 0,
      locked: true,
      version: 0,
    } as const,
    {
      id: 'formation-left-stripe',
      type: 'rect',
      x: PITCH.x + PITCH.width / 2,
      y: PITCH.y + 6,
      width: PITCH.width / 2 - 6,
      height: PITCH.height - 12,
      fills: [{ type: 'solid', value: colors.pitchLight, opacity: 0.42 }],
      zIndex: 1,
      locked: true,
      version: 0,
    } as const,
    {
      id: 'formation-halfway',
      type: 'rect',
      x: PITCH.x + 12,
      y: PITCH.y + PITCH.height / 2 - 3,
      width: PITCH.width - 24,
      height: 6,
      fills: [{ type: 'solid', value: colors.line, opacity: 0.9 }],
      zIndex: 2,
      locked: true,
      version: 0,
    } as const,
    {
      id: 'formation-center-circle',
      type: 'ellipse',
      x: PITCH.x + PITCH.width / 2 - 110,
      y: PITCH.y + PITCH.height / 2 - 110,
      width: 220,
      height: 220,
      fills: [],
      strokes: [{ type: 'solid', value: colors.line, opacity: 0.9 }],
      strokeWidth: 5,
      zIndex: 2,
      locked: true,
      version: 0,
    } as const,
    {
      id: 'formation-top-box',
      type: 'rect',
      x: PITCH.x + PITCH.width / 2 - 230,
      y: PITCH.y + 6,
      width: 460,
      height: 150,
      fills: [],
      strokes: [{ type: 'solid', value: colors.line, opacity: 0.9 }],
      strokeWidth: 5,
      zIndex: 2,
      locked: true,
      version: 0,
    } as const,
    {
      id: 'formation-bottom-box',
      type: 'rect',
      x: PITCH.x + PITCH.width / 2 - 230,
      y: PITCH.y + PITCH.height - 156,
      width: 460,
      height: 150,
      fills: [],
      strokes: [{ type: 'solid', value: colors.line, opacity: 0.9 }],
      strokeWidth: 5,
      zIndex: 2,
      locked: true,
      version: 0,
    } as const,
  ];
}

function buildPlayerNodes(
  teamId: TeamId,
  formationId: FormationId,
  tItem: (key: string) => string,
): SerializedNode[] {
  const rows = TEAM_FORMATIONS[teamId][formationId];
  const usableTop = PITCH.y + 145;
  const usableBottom = PITCH.y + PITCH.height - 125;
  const rowGap = (usableBottom - usableTop) / (rows.length - 1);

  return rows.flatMap((row, rowIndex) => {
    const y = usableTop + rowIndex * rowGap;
    const players = row.players;

    return players.flatMap((player, playerIndex) => {
      const x = PITCH.x + ((playerIndex + 1) * PITCH.width) / (players.length + 1);
      const id = `${teamId}-${formationId}-${row.label}-${player.number}`;
      const zIndex = 10 + rowIndex * 10 + playerIndex;

      return [
        {
          id: `${id}-card`,
          type: 'rect',
          name: `${player.position} ${player.name}`,
          x: x - 72,
          y: y - 58,
          width: 144,
          height: 156,
          cornerRadius: 22,
          fills: [{ type: 'solid', value: colors.card, opacity: 0.94 }],
          strokes: [{ type: 'solid', value: colors.cardStroke, opacity: 1 }],
          strokeWidth: 2,
          zIndex,
          version: 0,
        } as const,
        {
          id: `${id}-avatar`,
          type: 'rect',
          name: tItem('avatarLabel'),
          x: x - 42,
          y: y - 44,
          width: 84,
          height: 84,
          cornerRadius: 42,
          fills: [
            {
              type: 'image',
              value: avatarDataUrl(player),
              opacity: 1,
              objectFit: 'cover',
            },
          ],
          strokes: [{ type: 'solid', value: colors.line, opacity: 1 }],
          strokeWidth: 3,
          zIndex: zIndex + 1,
          version: 0,
        } as const,
        textNode(
          `${id}-number`,
          `#${player.number} · ${player.position}`,
          x - 48,
          y + 63,
          18,
          zIndex + 2,
          colors.muted,
        ),
        textNode(`${id}-name`, player.name, x - 62, y + 88, 20, zIndex + 2),
      ];
    });
  });
}

function buildFormationNodes(
  teamId: TeamId,
  formationId: FormationId,
  tItem: (key: string) => string,
): SerializedNode[] {
  return [
    ...buildPitchNodes(tItem),
    textNode(
      'formation-title',
      `${tItem(`teams.${teamId}`)} · ${formationId}`,
      PITCH.x,
      PITCH.y - 36,
      34,
      30,
      colors.text,
    ),
    textNode(
      'formation-source',
      tItem('dataSource'),
      PITCH.x,
      PITCH.y + PITCH.height + 46,
      22,
      30,
      colors.muted,
    ),
    ...buildPlayerNodes(teamId, formationId, tItem),
  ];
}

export function FootballFormationTool() {
  const tItem = useTranslations('tools.items.footballFormation');
  const [teamId, setTeamId] = useState<TeamId>('portugal');
  const [formationId, setFormationId] = useState<FormationId>('4-4-2');
  const [version, setVersion] = useState(0);
  const nodes = useMemo(
    () => buildFormationNodes(teamId, formationId, tItem),
    [teamId, formationId, tItem, version],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar hideCenterContent />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {tItem('title')}
          </h1>
          <p className="text-muted-foreground text-sm">{tItem('description')}</p>
        </header>
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end">
          <div className="grid gap-2">
            <Label htmlFor="formation-team">{tItem('teamLabel')}</Label>
            <Select value={teamId} onValueChange={(value) => setTeamId(value as TeamId)}>
              <SelectTrigger id="formation-team" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAM_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {tItem(`teams.${id}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="formation-shape">{tItem('formationLabel')}</Label>
            <Select
              value={formationId}
              onValueChange={(value) => setFormationId(value as FormationId)}
            >
              <SelectTrigger id="formation-shape" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATION_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="sm:ml-auto"
            onClick={() => setVersion((current) => current + 1)}
          >
            <RefreshCcw className="size-4" aria-hidden />
            {tItem('resetCanvas')}
          </Button>
        </section>
        <div className="flex min-h-0 flex-1">
          <div className="h-[760px] w-full flex-1">
            <Canvas
              key={`${teamId}-${formationId}-${version}`}
              id={`football-formation-${teamId}-${formationId}-${version}`}
              initialData={nodes}
              initialAppState={{
                cameraZoom: 0.55,
                penbarAll: [
                  Pen.HAND,
                  Pen.SELECT,
                  Pen.DRAW_RECT,
                  Pen.DRAW_ELLIPSE,
                  Pen.IMAGE,
                  Pen.TEXT,
                  Pen.LASER_POINTER,
                  Pen.ERASER,
                ],
                taskbarSelected: [Task.SHOW_LAYERS_PANEL, Task.SHOW_PROPERTIES_PANEL],
                penbarNameLabelVisible: true,
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
