# ODC Data Driven Manager

Objeto Digital de Conocimiento (ODC) **«Data Driven Manager: Herramientas de Big Data y Analítica para la Toma de Decisiones Organizacionales»**, empaquetado como **SCORM 1.2** para Moodle.

Universidad de Cundinamarca · Especialización en Inteligencia Artificial
Autores: Kevin Esteban Chiquillo Díaz y Dominic Nicolás Alonso Barajas

## Contenido

33 pantallas en ocho módulos, con Insight como guía virtual:

1. Fundamentos de Big Data y Business Analytics
2. Calidad y gobernanza de datos
3. Analítica descriptiva, predictiva y prescriptiva
4. Sistemas de apoyo a la decisión
5. Inteligencia artificial aplicada a la gestión
6. Visualización e interpretación de datos
7. Casos empresariales reales (Netflix, UPS, Walmart)
8. Simuladores de toma de decisiones

Incluye actividades de arrastrar y soltar, el detective de datos, cuestionarios, la ficha de análisis de caso, dos simuladores, la evaluación final (10 preguntas), conclusiones, créditos y referencias en APA 7.

## Estructura

```
scorm/                 Paquete SCORM (todo lo que va dentro del ZIP)
  imsmanifest.xml      Manifiesto SCORM 1.2
  index.html           Las 33 pantallas
  css/styles.css       Estilos
  js/scorm.js          Conexión con el LMS (API SCORM 1.2)
  js/app.js            Navegación, audio de Insight, actividades y calificación
  assets/insight.png   Avatar de Insight
  fonts/               Fuente Nunito (licencia SIL OFL)
  audio/               (vacía) locuciones opcionales de Insight
probar-lms.html        LMS de prueba para revisar el paquete sin Moodle
tools/empaquetar.py    Genera el ZIP para Moodle
```

## Probar en local

El curso necesita un servidor local (si se abre con doble clic, el navegador bloquea la conexión con el LMS de prueba):

```bash
python -m http.server 8765
```

Luego abre <http://127.0.0.1:8765/probar-lms.html>. La barra superior muestra en vivo el estado, la nota, la ubicación y las interacciones que el curso envía al LMS. **Reiniciar intento** borra el progreso.

## Generar el paquete para Moodle

```bash
python tools/empaquetar.py
```

Crea `dist/ODC_DataDrivenManager_SCORM12.zip`. En Moodle: *Agregar una actividad → Paquete SCORM* y sube el ZIP sin descomprimirlo.

## Calificación

| Componente | Peso |
|---|---|
| Actividades de módulo (1 a 7) | 40 % |
| Simuladores (2) | 35 % |
| Evaluación final (10 preguntas × 10 puntos) | 25 % |

Se aprueba con **70 o más**. El estado `passed`/`failed` se envía al terminar la evaluación final; antes, el estado es `incomplete`. Los pesos y la nota mínima se cambian en `WEIGHTS` y `PASS_SCORE`, en [`scorm/js/app.js`](scorm/js/app.js).

## Audio de Insight

Por defecto, Insight lee el guion de cada pantalla con la voz del navegador. Para usar locuciones grabadas, guárdalas como `scorm/audio/pantalla-01.mp3`, `pantalla-02.mp3`, … (número de pantalla con dos dígitos), agrégalas a `imsmanifest.xml` y cambia `USE_AUDIO_FILES` a `true` en `scorm/js/app.js`.

## Licencias

- Fuente **Nunito**: SIL Open Font License 1.1 ([`scorm/fonts/OFL.txt`](scorm/fonts/OFL.txt)).
