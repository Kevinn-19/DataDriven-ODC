# CONTEXTO DEL PROYECTO · ODC Data Driven Manager

> Estado revisado el 03/11/2026. Este archivo resume qué existe, dónde está y qué falta para cerrar el **storyboard** del Objeto Digital de Conocimiento (ODC).

## 1. Ficha del ODC

| Campo | Valor |
|---|---|
| Título | Data Driven Manager: Herramientas de Big Data y Analítica para la Toma de Decisiones Organizacionales |
| Institución | Universidad de Cundinamarca · Oficina de Educación Virtual y a Distancia (OEVD) |
| Programa | Especialización en Inteligencia Artificial (opción de grado: construcción de ODC) |
| Autores | Kevin Esteban Chiquillo Díaz · Dominic Nicolás Alonso Barajas |
| Guía virtual | **Insight** (avatar creado con IA generativa) |
| Grupo objetivo | Directivos, mandos medios, analistas y estudiantes de posgrado o de últimos semestres. Nivel básico–intermedio, sin programación previa |
| REA | Analizar y proponer decisiones organizacionales basadas en datos: seleccionar herramientas de Big Data y analítica, evaluar la calidad y la gobernanza de los datos, interpretar visualizaciones y valorar el aporte y los riesgos de la IA |
| Formato final | Paquete **SCORM 1.2** para Moodle (33 pantallas) |

## 2. Archivos del proyecto

### 2.1 En esta carpeta (el ODC ya construido)

| Ruta | Qué es |
|---|---|
| `scorm/index.html` | Las **33 pantallas** del curso, con texto visible y guion de Insight |
| `scorm/js/app.js` | Navegación, voz de Insight, actividades, bancos de preguntas y calificación (`WEIGHTS`, `PASS_SCORE = 70`, `MAX_ATTEMPTS = 3`, `USE_AUDIO_FILES = false`) |
| `scorm/js/scorm.js` | Conexión con el LMS (API SCORM 1.2) |
| `scorm/css/styles.css` | Estilos, tema claro/oscuro y fondo animado |
| `scorm/assets/insight.png` | Avatar de Insight |
| `scorm/audio/` | **Vacía**: Insight habla con la voz sintética del navegador |
| `scorm/imsmanifest.xml` | Manifiesto SCORM 1.2 |
| `probar-lms.html` | LMS de prueba para revisar el curso sin Moodle (`python -m http.server 8765`) |
| `tools/empaquetar.py` | Genera `dist/ODC_DataDrivenManager_SCORM12.zip` |

La carpeta **no es un repositorio git**: es la descarga `DataDriven-ODC-main.zip` descomprimida.

### 2.2 En `C:\Users\Domin\Downloads` (storyboard e investigación)

| Archivo | Fecha | Qué es |
|---|---|---|
| **`Storyboard ODC (1).pptx`** | 03/11 | **Storyboard de trabajo actual**, sobre la plantilla institucional. 37 diapositivas, alineado con las 33 pantallas del curso. **Es el que se debe seguir y completar** |
| `Storyboard ODC.pptx` | 12/10 | Plantilla OEVD en blanco (9 diapositivas: guía, pantalla tipo, metadatos y referencias) |
| `Storyboard_DataDrivenManager.pptx` / `(1).pptx` | 12/10 y 24/10 | Versiones anteriores (39 y 54 diapositivas, hasta 46 pantallas). **Obsoletas**: describen pantallas que no se construyeron |
| `MATRIZ DE REVISION DE LITERATURA_2026-2 Version Final.xlsx` | 20/09 | Investigación: **30 estudios** analizados |
| `plantilla-normas-apa.docx`, `plantilla-titulos-normas-apa-7-mentur.docx` | 26/09 | Plantillas APA 7 |
| `Mi pregunta de Investigación.pdf` | 20/09 | Pregunta de investigación |

## 3. Lo que exige la plantilla institucional

1. **Hoja 2 (diseño):** metodología, evaluación, REA, grupo objetivo y **CADI** al que aporta el ODC, con la razón.
2. **Cada pantalla tiene 4 numerales:** ① imagen de la interfaz · ② número de pantalla · ③ texto visible · ④ voces y audios (guion discursivo).
3. **Pie institucional** «Oficina de Educación Virtual y a Distancia» en la pantalla tipo, los metadatos y las referencias.
4. Hay que **eliminar las hojas rosadas** de instrucciones antes de entregar.
5. **Actividades** con realimentación enriquecida: gamificación, falso/verdadero, opción múltiple, arrastrar y soltar.
6. **Videos de 5 minutos como máximo**. Audios con lenguaje consciente.
7. **APA 7** en textos e imágenes. Solo material Creative Commons o Copyleft, nada con copyright.
8. **Metadatos:** área, título, autor, diseño y desarrollo, imágenes, sonidos y voces, fecha (D/M/A) y nivel. Hay que poner los **nombres completos** de los roles marcados en rojo.
9. **Referencias** de todos los recursos externos.

## 4. Estado de `Storyboard ODC (1).pptx`

### 4.1 Estructura de las diapositivas

| Diapositiva | Contenido |
|---|---|
| 1 | Portada del storyboard |
| 2 | Hoja de diseño: metodología, evaluación, REA, grupo objetivo, temáticas y CADI |
| 3–34 | Pantallas 1 a 32 del curso, en el mismo orden (todas las secciones del curso tienen su diapositiva) |
| 35 | Metadatos y créditos (equivale a la pantalla 33 del curso) |
| 36–37 | Referencias APA 7 (1/2 y 2/2), ya con los estudios de la matriz |

Ya no hay hojas rosadas. Las 32 diapositivas de pantalla tienen bloque de audio de Insight y una maqueta de interfaz (no capturas reales del curso).

### 4.2 Avance del contenido

| Diapositivas | Estado |
|---|---|
| 3–6, 8–9, 11, 13–14 (portada, ruta, M1, M2, M3, M4) | **Reescritas con el texto del curso** |
| 15, 32–33 (cuestionario y evaluación final) | Preguntas iguales al banco de `app.js` |
| 7, 10, 12, 19, 23 (actividades) y 16–31, 34 (M5 a M8 y conclusiones) | **Conservan buena parte del texto del storyboard anterior.** Hay que contrastarlas con el curso, sobre todo los casos (25–27), las actividades y los simuladores (30–31) |

### 4.3 Errores concretos que hay que corregir

| Dónde | Problema | Corrección |
|---|---|---|
| Diapositiva 9 | Dice «Pantalla 6», igual que la 8 | Pantalla 7. Desde aquí **toda la numeración va corrida en 1**: la diapositiva *n* es la pantalla *n − 2* |
| Diapositivas 35–37 | Numeradas como pantallas 44, 45 y 46 | Pantalla 33 (créditos y referencias) |
| Diapositiva 2 | «43 pantallas» | 33 pantallas |
| Diapositiva 2 | Módulo 7 incluye «Colombia» | El curso solo tiene Netflix, UPS y Walmart |
| Diapositiva 2 | Promete «insignias», «certificado de participación», «mapa de ruta» con desbloqueo, «videos» y de 6 a 8 horas | En el curso **no hay** insignias, certificado, desbloqueo ni videos. Hay que quitarlos o construirlos. Sí son reales: 3 intentos por actividad y 2 por pregunta de la evaluación final |
| Diapositiva 2 | El campo CADI justifica el enfoque, pero **no nombra el CADI** | Agregar el nombre exacto, confirmado con la docente |
| Diapositiva 1 | `Fecha de entrega: ____ / ____ / 2026` | Completar |
| Diapositiva 14 | «El proceso de desicion» | «El proceso de decisión» |
| Diapositiva 15 | La lista de opciones (B Diseño, C Inteligencia) no coincide con la maqueta ni con el curso (B Inteligencia, C Diseño) | Usar el orden del curso |
| Diapositiva 31 | El encabezado dice «SIMULADOR 3» | Simulador 2 |
| Diapositiva 32 | La lista dice «D) Valor» y la maqueta y el curso dicen «D) Veracidad». La realimentación dice «S.e trata» | Unificar y corregir |
| Diapositiva 35 | El bloque de créditos dice «Autor: Kevin…» aunque arriba figuran los dos autores. Imágenes y voces siguen con `[Indicar…]` | Poner los dos autores en créditos y llenar las licencias |
| Diapositivas 3–31, 33–34 | No tienen el pie «Oficina de Educación Virtual y a Distancia» (solo lo tienen la 32 y la 35–37) | Agregarlo si la OEVD lo exige en cada pantalla |

## 5. Decisiones abiertas

1. **Hoja 2:** ¿se ajusta la metodología a lo que el curso hace realmente, o se construyen en el SCORM las insignias y el certificado?
2. **CADI:** nombre exacto, que debe confirmar la docente.
3. **Voz de Insight:** ¿se queda la voz del navegador (Web Speech API) o se graban locuciones (`scorm/audio/pantalla-NN.mp3`)? Esto define el campo «Sonidos y voces».
4. **Imágenes:** con qué herramienta se generó el avatar de Insight y bajo qué licencia.
5. **Interfaz (numeral ①):** ¿se mantienen las maquetas dibujadas o se reemplazan por capturas reales del curso?
