# Investigación de Sistemas TTS para TavernFlow

## Resumen Ejecutivo

Después de una investigación exhaustiva, recomiendo **Chatterbox TTS** como la solución principal, con **RVC** como capa adicional para clonación de voces específicas.

---

## Comparativa Detallada

### 1. VibeVoice-Realtime-0.5B (Microsoft)

| Aspecto | Detalle |
|---------|---------|
| **Latencia** | <300ms (excelente para tiempo real) |
| **VRAM** | ~2.2GB (muy ligero) |
| **Parámetros** | 0.5B |
| **Idiomas** | Solo inglés |
| **Voces** | Un solo speaker |
| **Clonación de voz** | ❌ No soportada (usará RVC) |
| **Código abierto** | ✅ Sí (MIT License) |

**Limitaciones críticas:**
- El modelo 0.5B solo soporta **un speaker** (single speaker)
- **Solo inglés** - no sirve para español
- **No permite clonación de voces personalizadas**
- Microsoft restringió la clonación para prevenir deepfakes

**Modelo 1.5B (alternativa):**
- Soporta hasta 4 speakers
- Sintetiza hasta 90 minutos de audio
- Requiere más VRAM (~8GB+)
- Aún sin clonación de voz personalizada

---

### 2. Chatterbox TTS (Resemble AI)

| Aspecto | Detalle |
|---------|---------|
| **Latencia** | ~150ms (Turbo) / ~500ms (estándar) |
| **VRAM** | ~5GB para GPU |
| **Parámetros** | Varía según modelo |
| **Idiomas** | 22-23 idiomas (incluye español) |
| **Voces** | Ilimitadas (clonación zero-shot) |
| **Clonación de voz** | ✅ Zero-shot desde 5 seg de audio |
| **API** | OpenAI-compatible |
| **Código abierto** | ✅ Sí |

**Variantes disponibles:**
1. **Chatterbox Original** - Inglés, control de emociones
2. **Chatterbox Multilingual** - 23 idiomas, clonación de voz
3. **Chatterbox Turbo** - <150ms latencia, inglés solo

**Ventajas principales:**
- ✅ Clonación de voz instantánea desde audio de referencia
- ✅ Soporte multilingüe (español incluido)
- ✅ API compatible con OpenAI
- ✅ Servidor FastAPI disponible

---

### 3. AllTalk TTS (Alternativa)

| Aspecto | Detalle |
|---------|---------|
| **Motor base** | Coqui XTTS |
| **Motores soportados** | XTTS, F5-TTS, VITS, Piper |
| **Clonación de voz** | ✅ Zero-shot |
| **API** | OpenAI-compatible + endpoints propios |
| **RVC integrado** | ✅ Soporte incluido |

---

## Arquitectura Recomendada

```
┌─────────────────────────────────────────────────────────────┐
│                     TAVERNFLOW (Next.js)                     │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Chat UI    │    │  Voice Config │    │  Audio Player │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                    │          │
│         └───────────────────┼────────────────────┘          │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │   API Route     │                      │
│                    │  /api/tts       │                      │
│                    └────────┬────────┘                      │
└─────────────────────────────┼───────────────────────────────┘
                              │
                              │ HTTP Request
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                PYTHON SERVICE (FastAPI)                      │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Chatterbox  │───▶│   RVC Model  │───▶│  Audio Out   │  │
│  │  TTS Server  │    │  (opcional)  │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Model Cache (modelos en memoria)                    │  │
│  │  - Chatterbox Multilingual                           │  │
│  │  - RVC Voice Models (.pth)                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## ¿Por qué Chatterbox + RVC?

### Justificación de Chatterbox:

1. **Multilingüe nativo**: Soporta español sin configuración adicional
2. **Clonación zero-shot**: Solo necesitas 5-10 segundos de audio de referencia
3. **API OpenAI-compatible**: Fácil integración con código existente
4. **Calidad demostrada**: Considerado el mejor TTS open-source actual
5. **Comunidad activa**: Documentación y soporte extenso

### Por qué agregar RVC:

1. **Voces específicas**: Chatterbox clona la voz pero RVC perfecciona el timbre
2. **Modelos pre-entrenados**: Puedes usar modelos RVC de personajes específicos
3. **Post-procesamiento**: Aplicar RVC después de Chatterbox para mayor fidelidad
4. **Flexibilidad**: Cambiar entre voces sin reentrenar

---

## Requisitos de Hardware

### Mínimo (CPU):
- RAM: 16GB
- Almacenamiento: 15GB (modelos + cache)
- Latencia: 2-5 segundos por oración

### Recomendado (GPU):
- GPU: NVIDIA con 6GB+ VRAM (GTX 1660 Super o superior)
- RAM: 16GB
- VRAM: 6GB para Chatterbox + RVC
- Latencia: <500ms por oración

### Óptimo:
- GPU: RTX 3060 12GB o superior
- RAM: 32GB
- VRAM: 12GB+ (permite múltiples modelos)
- Latencia: <200ms por oración

---

## Implementación Técnica

### Opción A: Chatterbox TTS Server (Recomendada)

```bash
# Instalación
git clone https://github.com/devnen/Chatterbox-TTS-Server
cd Chatterbox-TTS-Server
pip install -r requirements.txt

# Ejecutar servidor
python server.py --port 8000 --model chatterbox-multilingual
```

**Endpoint OpenAI-compatible:**
```typescript
// Desde Next.js API Route
const response = await fetch('http://localhost:8000/v1/audio/speech', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'chatterbox-multilingual',
    input: 'Hola, esta es una prueba de voz.',
    voice: 'reference_audio.wav', // Audio de referencia para clonación
    response_format: 'mp3'
  })
});
```

### Opción B: Implementación Personalizada

```python
# tts_service.py (FastAPI)
from fastapi import FastAPI, UploadFile, File
from chatterbox.tts import ChatterboxTTS
import torch

app = FastAPI()

# Cargar modelo una vez al iniciar
device = "cuda" if torch.cuda.is_available() else "cpu"
tts_model = ChatterboxTTS.load_model("chatterbox-multilingual", device)

@app.post("/api/tts/generate")
async def generate_speech(
    text: str,
    reference_audio: UploadFile = File(None)
):
    # Si hay audio de referencia, clonar voz
    if reference_audio:
        audio_bytes = await reference_audio.read()
        voice_embedding = tts_model.extract_voice_embedding(audio_bytes)
        audio = tts_model.generate(
            text=text,
            voice_embedding=voice_embedding,
            language="es"
        )
    else:
        audio = tts_model.generate(text=text, language="es")
    
    return {"audio": audio.to_base64()}
```

### Integración con RVC

```python
# rvc_service.py
from rvc import VoiceConverter

class RVCProcessor:
    def __init__(self, model_path: str):
        self.converter = VoiceConverter.load(model_path)
    
    def convert(self, audio_input, f0_method="rmvpe"):
        return self.converter.convert(
            input_audio=audio_input,
            f0_method=f0_method,
            f0_up_key=0  # Cambiar tono si es necesario
        )

# Uso combinado
tts_audio = tts_model.generate(text, voice_embedding)
final_audio = rvc_processor.convert(tts_audio)
```

---

## Estimación de Recursos

### Almacenamiento necesario:
```
Chatterbox Multilingual:    ~3GB
RVC Model (por modelo):     ~100-300MB
Modelos de voces RVC:       ~50-200MB cada uno
Audio de referencia:        ~1-5MB cada uno
-----------------------------------------
Total inicial:              ~5GB
Con 10 voces RVC:           ~7GB
```

### VRAM en runtime:
```
Chatterbox cargado:         ~4-5GB
RVC cargado:                ~500MB-1GB
Buffer de procesamiento:    ~500MB
-----------------------------------------
Total necesario:            ~6-7GB VRAM
```

---

## Plan de Implementación

### Fase 1: Básico (2-3 días)
1. Configurar servidor Chatterbox TTS
2. Crear API route en Next.js
3. Integrar reproducción de audio en el chat

### Fase 2: Clonación de voz (2-3 días)
1. Implementar carga de audio de referencia
2. Configurar voces por personaje
3. Persistir configuración de voces

### Fase 3: RVC Integration (3-4 días)
1. Agregar RVC como post-procesador
2. Crear interfaz para gestionar modelos RVC
3. Optimizar pipeline de audio

### Fase 4: Optimización (1-2 días)
1. Caching de embeddings de voz
2. Streaming de audio
3. Queue para múltiples peticiones

---

## Alternativa: API Externa

Si no deseas ejecutar Python localmente, puedes usar:

1. **Replicate API** - Chatterbox hosted
2. **ElevenLabs API** - Pago, calidad superior
3. **OpenAI TTS API** - Pago, sin clonación

---

## Conclusión

**Recomendación final: Chatterbox TTS + RVC**

Justificación:
- ✅ Soporte nativo para español
- ✅ Clonación de voz zero-shot
- ✅ API fácil de integrar
- ✅ Código abierto y gratis
- ✅ Calidad competitiva con servicios de pago
- ✅ RVC como capa de mejora opcional

No recomiendo VibeVoice-Realtime para tu caso porque:
- ❌ Solo inglés
- ❌ No permite clonación de voz
- ❌ Requeriría RVC de todos modos
