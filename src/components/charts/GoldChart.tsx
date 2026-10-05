"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  ColorType,
  CrosshairMode,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/analysis/types";

export interface ChartPriceLine {
  price: number;
  color: string;
  title: string;
  dashed?: boolean;
}
export interface ChartMarker {
  time: number;
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "arrowUp" | "arrowDown" | "circle";
  text: string;
}

export function GoldChart({
  data,
  ema,
  priceLines = [],
  markers = [],
  height = 420,
}: {
  data: Candle[];
  ema?: { time: number; value: number }[];
  priceLines?: ChartPriceLine[];
  markers?: ChartMarker[];
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const emaRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);

  // création du chart
  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(233,228,216,0.55)",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(212,175,55,0.05)" },
        horzLines: { color: "rgba(212,175,55,0.05)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(212,175,55,0.35)", labelBackgroundColor: "#8a6d2a" },
        horzLine: { color: "rgba(212,175,55,0.35)", labelBackgroundColor: "#8a6d2a" },
      },
      rightPriceScale: { borderColor: "rgba(212,175,55,0.15)" },
      timeScale: {
        borderColor: "rgba(212,175,55,0.15)",
        timeVisible: true,
        secondsVisible: false,
      },
      localization: { locale: "fr-FR" },
      width: ref.current.clientWidth,
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#2dd4a0",
      downColor: "#f4637c",
      wickUpColor: "rgba(45,212,160,0.7)",
      wickDownColor: "rgba(244,99,124,0.7)",
      borderVisible: false,
    });
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    chart.priceScale("").applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });
    const emaLine = chart.addSeries(LineSeries, {
      color: "#e8c85f",
      lineWidth: 2,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    candleRef.current = candles;
    volRef.current = vol;
    emaRef.current = emaLine;
    markersRef.current = createSeriesMarkers(candles, []);

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) chart.applyOptions({ width: e.contentRect.width });
    });
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      linesRef.current = [];
    };
  }, []);

  // données
  useEffect(() => {
    if (!candleRef.current || !volRef.current || !emaRef.current || !chartRef.current) return;
    candleRef.current.setData(
      data.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );
    volRef.current.setData(
      data.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(45,212,160,0.25)" : "rgba(244,99,124,0.25)",
      }))
    );
    emaRef.current.setData(
      (ema ?? []).map((p) => ({ time: p.time as UTCTimestamp, value: p.value }))
    );
    markersRef.current?.setMarkers(
      [...markers]
        .sort((a, b) => a.time - b.time)
        .map((m) => ({
          time: m.time as UTCTimestamp,
          position: m.position,
          color: m.color,
          shape: m.shape,
          text: m.text,
          size: 1,
        }))
    );
    for (const l of linesRef.current) candleRef.current.removePriceLine(l);
    linesRef.current = priceLines.map((pl) =>
      candleRef.current!.createPriceLine({
        price: pl.price,
        color: pl.color,
        lineWidth: 1,
        lineStyle: pl.dashed ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true,
        title: pl.title,
      })
    );
    chartRef.current.timeScale().scrollToRealTime();
  }, [data, ema, priceLines, markers]);

  return <div ref={ref} style={{ height }} className="w-full" />;
}
