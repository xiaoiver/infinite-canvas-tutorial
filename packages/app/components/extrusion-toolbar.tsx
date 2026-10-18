'use client';

import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { Box } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  Extrude3DAttributes,
  Extrude3DOptions,
  SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { canExtrudePath } from '@infinite-canvas-tutorial/ecs';
import type { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';
import { canvasApiAtom, selectedNodesAtom } from '@/atoms/canvas-selection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type Extrusion = Extrude3DAttributes['extrude3d'];

function canExtrudeSelectedNode(api: ExtendedAPI, nodeId: string): boolean {
  const node = api.getNodeById(nodeId);
  return (
    node?.type === 'rect' ||
    (node?.type === 'path' && canExtrudePath(node, api.getNodes()))
  );
}

function optionsFrom(value: Extrusion): Extrude3DOptions | undefined {
  if (value === undefined || value === false) return;
  if (typeof value === 'object')
    return {
      ...value,
      depth:
        typeof value.depth === 'number' &&
        Number.isFinite(value.depth) &&
        value.depth > 0
          ? value.depth
          : 100,
    };
  return {
    depth:
      typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : 100,
  };
}

export function ExtrusionToolbar() {
  const api = useAtomValue(canvasApiAtom);
  const selected = useAtomValue(selectedNodesAtom);
  const node = selected.length === 1 ? selected[0] : undefined;
  const eligible = node?.type === 'rect' || node?.type === 'path';
  if (!eligible || !node || !api) return null;
  return <ExtrusionControls key={node.id} api={api} nodeId={node.id} />;
}

function ExtrusionControls({
  api,
  nodeId,
}: {
  api: ExtendedAPI;
  nodeId: string;
}) {
  const t = useTranslations('toolbar');
  const initial = api.getNodeById(nodeId);
  const initialValue =
    initial && 'extrude3d' in initial ? initial.extrude3d : undefined;
  const initialOptions = optionsFrom(initialValue);
  const [value, setValue] = useState<Extrusion>(initialValue);
  const [depth, setDepth] = useState(String(initialOptions?.depth ?? 40));
  const [bevel, setBevel] = useState(String(initialOptions?.bevelSize ?? 0));
  const [bevelSegments, setBevelSegments] = useState(
    String(initialOptions?.bevelSegments ?? 1),
  );
  const [sideColor, setSideColor] = useState(initialOptions?.sideColor ?? '');
  const [canExtrude, setCanExtrude] = useState(() =>
    canExtrudeSelectedNode(api, nodeId),
  );

  const update = (extrude3d: Extrusion) => {
    const current = api.getNodeById(nodeId);
    if (!current || (current.type !== 'rect' && current.type !== 'path'))
      return;
    api.updateNode(current, { extrude3d } as Partial<SerializedNode>);
    api.record();
    setValue(extrude3d);
  };

  const updateNumber = (
    field: 'depth' | 'bevelSize' | 'bevelSegments',
    text: string,
  ) => {
    const number = Number(text);
    if (
      !Number.isFinite(number) ||
      (field === 'depth' ? number <= 0 : number < 0) ||
      (field === 'bevelSegments' &&
        (!Number.isInteger(number) || number < 1 || number > 8))
    ) {
      const previous = optionsFrom(value);
      const reset =
        field === 'depth'
          ? setDepth
          : field === 'bevelSize'
          ? setBevel
          : setBevelSegments;
      reset(
        String(
          previous?.[field] ??
            (field === 'depth' ? 40 : field === 'bevelSize' ? 0 : 1),
        ),
      );
      return;
    }
    const current = api.getNodeById(nodeId);
    const previous =
      current && 'extrude3d' in current
        ? optionsFrom(current.extrude3d)
        : undefined;
    if (!previous) return;
    if (
      (previous[field] ??
        (field === 'depth' ? 100 : field === 'bevelSize' ? 0 : 1)) === number
    )
      return;
    update({ ...previous, [field]: number });
  };

  const updateSideColor = (text: string) => {
    const color = text.trim();
    const current = api.getNodeById(nodeId);
    const previous =
      current && 'extrude3d' in current
        ? optionsFrom(current.extrude3d)
        : undefined;
    if (!previous) return;
    if (color && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
      setSideColor(previous.sideColor ?? '');
      return;
    }
    if ((previous.sideColor ?? '') === color) return;
    update({ ...previous, sideColor: color || undefined });
  };

  const active = !!optionsFrom(value);
  return (
    <Popover
      onOpenChange={(open) => {
        if (!open) return;
        const current = api.getNodeById(nodeId);
        const extrusion =
          current && 'extrude3d' in current ? current.extrude3d : undefined;
        const options = optionsFrom(extrusion);
        setCanExtrude(canExtrudeSelectedNode(api, nodeId));
        setValue(extrusion);
        setDepth(String(options?.depth ?? 40));
        setBevel(String(options?.bevelSize ?? 0));
        setBevelSegments(String(options?.bevelSegments ?? 1));
        setSideColor(options?.sideColor ?? '');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant={active ? 'default' : 'outline'}
          size="sm"
          aria-label={t('extrusion')}
        >
          <Box className="size-4" /> {t('extrusion')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="space-y-3" align="center">
        <Button
          className="w-full"
          variant={active ? 'secondary' : 'default'}
          disabled={!active && !canExtrude}
          onClick={() =>
            update(
              active
                ? undefined
                : { depth: Number(depth) > 0 ? Number(depth) : 40 },
            )
          }
        >
          {active ? t('removeExtrusion') : t('extrude')}
        </Button>
        {active && (
          <>
            <div className="space-y-1">
              <Label htmlFor="extrusion-depth">{t('extrusionDepth')}</Label>
              <Input
                id="extrusion-depth"
                type="number"
                min="1"
                step="1"
                value={depth}
                onChange={(event) => setDepth(event.target.value)}
                onBlur={() => updateNumber('depth', depth)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="extrusion-bevel">{t('extrusionBevel')}</Label>
              <Input
                id="extrusion-bevel"
                type="number"
                min="0"
                step="1"
                value={bevel}
                onChange={(event) => setBevel(event.target.value)}
                onBlur={() => updateNumber('bevelSize', bevel)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="extrusion-bevel-segments">
                {t('extrusionBevelSegments')}
              </Label>
              <Input
                id="extrusion-bevel-segments"
                type="number"
                min="1"
                max="8"
                step="1"
                value={bevelSegments}
                onChange={(event) => setBevelSegments(event.target.value)}
                onBlur={() => updateNumber('bevelSegments', bevelSegments)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="extrusion-side-color">
                {t('extrusionSideColor')}
              </Label>
              <Input
                id="extrusion-side-color"
                type="text"
                placeholder={t('extrusionSideColorPlaceholder')}
                value={sideColor}
                onChange={(event) => setSideColor(event.target.value)}
                onBlur={() => updateSideColor(sideColor)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          {!active && !canExtrude
            ? t('extrusionUnsupported')
            : t('extrusionHint')}
        </p>
      </PopoverContent>
    </Popover>
  );
}
