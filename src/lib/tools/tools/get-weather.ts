// ============================================
// Tool: Get Weather
// ============================================
// Category: real_world
// Permission: auto
// Uses wttr.in (free, no API key required)

import type { ToolDefinition, ToolContext, ToolExecutionResult } from '../types';

export const getWeatherTool: ToolDefinition = {
  id: 'get_weather',
  name: 'get_weather',
  label: 'Consultar Clima',
  icon: 'CloudSun',
  description:
    'Obtén el clima actual de una ciudad. ' +
    'Usa esta herramienta cuando el usuario pregunte por el tiempo, temperatura, ' +
    'o condiciones climáticas de algún lugar.',
  category: 'real_world',
  parameters: {
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: 'Nombre de la ciudad (ej: "Monterrey", "CDMX", "Madrid")',
        required: true,
      },
      units: {
        type: 'string',
        enum: ['celsius', 'fahrenheit'],
        description: 'Unidad de temperatura (default: celsius)',
        required: false,
      },
    },
    required: ['city'],
  },
  permissionMode: 'auto',
};

export async function getWeatherExecutor(
  params: Record<string, unknown>,
  _context: ToolContext,
): Promise<ToolExecutionResult> {
  const city = String(params.city || '').trim();
  const units = params.units === 'fahrenheit' ? 'fahrenheit' : 'celsius';

  if (!city) {
    return {
      success: false,
      toolName: 'get_weather',
      result: null,
      displayMessage: 'Se requiere el nombre de una ciudad',
      error: 'EMPTY_CITY',
    };
  }

  try {
    const response = await fetch(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
      {
        headers: { 'User-Agent': 'TavernFlow/1.0' },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      return {
        success: false,
        toolName: 'get_weather',
        result: null,
        displayMessage: `No se pudo obtener el clima de "${city}"`,
        error: 'API_ERROR',
      };
    }

    const data = await response.json();
    const current = data.current_condition?.[0];

    if (!current) {
      return {
        success: false,
        toolName: 'get_weather',
        result: null,
        displayMessage: `No se encontraron datos para "${city}"`,
        error: 'NO_DATA',
      };
    }

    const temp = units === 'fahrenheit' ? current.temp_F : current.temp_C;
    const unitSymbol = units === 'fahrenheit' ? '°F' : '°C';
    const feelsLike = units === 'fahrenheit' ? current.FeelsLikeF : current.FeelsLikeC;
    const condition = current.weatherDesc?.[0]?.value || 'Desconocido';
    const humidity = current.humidity;
    const wind = current.windspeedKmph;
    const areaName = current.nearest_area?.[0]?.areaName?.[0]?.value || city;

    const displayMessage =
      `🌤️ Clima en ${areaName}: ${temp}${unitSymbol}, ${condition}\n` +
      `   Sensación: ${feelsLike}${unitSymbol} | Humedad: ${humidity}% | Viento: ${wind} km/h`;

    return {
      success: true,
      toolName: 'get_weather',
      result: {
        city: areaName,
        temperature: `${temp}${unitSymbol}`,
        feelsLike: `${feelsLike}${unitSymbol}`,
        condition,
        humidity: `${humidity}%`,
        wind: `${wind} km/h`,
      },
      displayMessage,
    };
  } catch (error) {
    return {
      success: false,
      toolName: 'get_weather',
      result: null,
      displayMessage: `Error al obtener el clima de "${city}"`,
      error: error instanceof Error ? error.message : 'Unknown',
    };
  }
}
