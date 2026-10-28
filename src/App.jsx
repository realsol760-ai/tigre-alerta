import { useState, useEffect, useCallback } from "react";
import { zonasInundables, puntosAnegamiento } from "./zonasInundables";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import L from "leaflet";

import {
  Activity,
  AlertTriangle,
  CloudRain,
  MapPin,
  Navigation,
  Waves,
  Search,
  ShieldAlert,
  Clock3,
  Route,
  RefreshCw,
  Thermometer,
  Wind,
  Eye,
  Filter,
  ExternalLink,
  Send,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";

import "./App.css";
import { supabase } from "./lib/supabaseClient";

const API_CLIMA =
  "https://api.open-meteo.com/v1/forecast?latitude=-34.42&longitude=-58.58&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,weather_code,wind_speed_10m&hourly=precipitation_probability,precipitation&daily=precipitation_probability_max,precipitation_sum,weather_code&timezone=America%2FArgentina%2FBuenos_Aires&forecast_days=1";

function describirClima(codigo) {
  if (codigo === 0) return "Despejado";
  if ([1, 2].includes(codigo)) return "Parcialmente nublado";
  if (codigo === 3) return "Nublado";
  if ([45, 48].includes(codigo)) return "Niebla";
  if ([51, 53, 55].includes(codigo)) return "Llovizna";
  if ([56, 57].includes(codigo)) return "Llovizna helada";
  if ([61, 63, 65].includes(codigo)) return "Lluvia";
  if ([66, 67].includes(codigo)) return "Lluvia helada";
  if ([71, 73, 75, 77].includes(codigo)) return "Nieve";
  if ([80, 81, 82].includes(codigo)) return "Chaparrones";
  if ([85, 86].includes(codigo)) return "Nevadas";
  if ([95, 96, 99].includes(codigo)) return "Tormenta";
  return "Estado meteorológico no identificado";
}

function FormatearHora(fecha) {
  if (!fecha) return "No disponible";

  return new Date(fecha).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function AjustarMapa() {
  const mapa = useMap();

  return (
    <button
      type="button"
      className="map-action-button"
      onClick={() => mapa.setView([-34.405, -58.625], 12)}
      title="Volver a la vista general de Tigre"
    >
      <Navigation size={16} />
      Ver todo Tigre
    </button>
  );
}
const iconoZona = L.divIcon({
className: "marcador-personalizado",
html: '<div style="width:18px;height:18px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
iconSize: [24, 24],
iconAnchor: [12, 12],
});

const iconoAnegamiento = L.divIcon({
className: "marcador-personalizado",
html: '<div style="width:18px;height:18px;background:#dc2626;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
iconSize: [24, 24],
iconAnchor: [12, 12],
});

function App() {
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");

  const [consultaRealizada, setConsultaRealizada] = useState(false);
  const [errorRuta, setErrorRuta] = useState("");

  const [clima, setClima] = useState(null);
  const [cargandoClima, setCargandoClima] = useState(false);
  const [errorClima, setErrorClima] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  const [mostrarZonas, setMostrarZonas] = useState(true);
  const [mostrarAntecedentes, setMostrarAntecedentes] = useState(true);

  // Reportes ciudadanos almacenados en Supabase
  const [reportes, setReportes] = useState([]);
  const [cargandoReportes, setCargandoReportes] = useState(true);
  const [enviandoReporte, setEnviandoReporte] = useState(false);
  const [mensajeReporte, setMensajeReporte] = useState("");
  const [errorReporte, setErrorReporte] = useState("");
  const [formReporte, setFormReporte] = useState({
    calle: "",
    localidad: "Rincón de Milberg",
    tipo_incidencia: "calle_anegada",
    nivel_agua: "no_sabe",
    descripcion: "",
    latitud: "",
    longitud: "",
  });

  const cargarReportes = useCallback(async () => {
    setCargandoReportes(true);
    try {
      const { data, error } = await supabase
        .from("reportes_inundacion")
        .select("*")
        .order("creado_en", { ascending: false })
        .limit(50);

      if (error) throw error;
      setReportes(data || []);
      setErrorReporte("");
    } catch (error) {
      console.error("Error al cargar reportes de Supabase:", error);
      setErrorReporte(
        "No pudimos cargar los reportes. Verificá la conexión y los permisos de la tabla."
      );
    } finally {
      setCargandoReportes(false);
    }
  }, []);

  useEffect(() => {
    cargarReportes();
  }, [cargarReportes]);

  function cambiarCampoReporte(event) {
    const { name, value } = event.target;
    setFormReporte((actual) => ({ ...actual, [name]: value }));
  }

  async function enviarReporte(event) {
    event.preventDefault();
    setMensajeReporte("");
    setErrorReporte("");

    if (!formReporte.calle.trim()) {
      setErrorReporte("Indicá la calle o intersección donde observaste el problema.");
      return;
    }

    const tieneLatitud = formReporte.latitud.trim() !== "";
    const tieneLongitud = formReporte.longitud.trim() !== "";
    if (tieneLatitud !== tieneLongitud) {
      setErrorReporte("Si cargás coordenadas, completá tanto la latitud como la longitud.");
      return;
    }

    let latitud = null;
    let longitud = null;
    if (tieneLatitud && tieneLongitud) {
      latitud = Number(formReporte.latitud);
      longitud = Number(formReporte.longitud);
      if (
        !Number.isFinite(latitud) ||
        !Number.isFinite(longitud) ||
        latitud < -90 ||
        latitud > 90 ||
        longitud < -180 ||
        longitud > 180
      ) {
        setErrorReporte("Las coordenadas no son válidas.");
        return;
      }
    }

    setEnviandoReporte(true);
    try {
      const { error } = await supabase.from("reportes_inundacion").insert({
        calle: formReporte.calle.trim(),
        localidad: formReporte.localidad,
        tipo_incidencia: formReporte.tipo_incidencia,
        nivel_agua: formReporte.nivel_agua,
        descripcion: formReporte.descripcion.trim() || null,
        latitud,
        longitud,
        estado: "pendiente",
      });

      if (error) throw error;

      setMensajeReporte(
        "Reporte enviado. Quedó pendiente de verificación; no se considera una confirmación oficial."
      );
      setFormReporte({
        calle: "",
        localidad: "Rincón de Milberg",
        tipo_incidencia: "calle_anegada",
        nivel_agua: "no_sabe",
        descripcion: "",
        latitud: "",
        longitud: "",
      });
      await cargarReportes();
    } catch (error) {
      console.error("Error al guardar reporte en Supabase:", error);
      setErrorReporte(
        "No se pudo enviar el reporte. Revisá que .env.local esté configurado y que la tabla tenga los permisos creados."
      );
    } finally {
      setEnviandoReporte(false);
    }
  }

  function formatearFechaReporte(fecha) {
    if (!fecha) return "Fecha no disponible";
    return new Date(fecha).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
    });
  }

  const consultarClima = useCallback(async () => {
    setCargandoClima(true);
    setErrorClima("");

    try {
      const respuesta = await fetch(API_CLIMA);

      if (!respuesta.ok) {
        throw new Error("No se pudo consultar el servicio meteorológico.");
      }

      const datos = await respuesta.json();

      if (!datos.current) {
        throw new Error("La fuente no devolvió datos meteorológicos.");
      }

      setClima(datos.current);
      setUltimaActualizacion(new Date());
    } catch (error) {
      setErrorClima(
        "No pudimos obtener el tiempo. Revisá tu conexión e intentá actualizar."
      );
    } finally {
      setCargandoClima(false);
    }
  }, []);

  useEffect(() => {
    consultarClima();
  }, [consultarClima]);

  function buscarRuta(event) {
    event.preventDefault();
    setErrorRuta("");
    setConsultaRealizada(false);

    if (!origen.trim() || !destino.trim()) {
      setErrorRuta("Completá el punto de partida y el destino.");
      return;
    }

    if (origen.trim().toLowerCase() === destino.trim().toLowerCase()) {
      setErrorRuta("El origen y el destino no pueden ser iguales.");
      return;
    }

    setConsultaRealizada(true);

    const url =
      "https://www.google.com/maps/dir/" +
      encodeURIComponent(origen.trim()) +
      "/" +
      encodeURIComponent(destino.trim()) +
      "/";

    window.open(url, "_blank", "noopener,noreferrer");
  }

  const temperatura = clima?.temperature_2m;
  const sensacion = clima?.apparent_temperature;
  const lluvia = clima?.precipitation;
  const viento = clima?.wind_speed_10m;
  const codigoClima = clima?.weather_code;

  return (
    <main className="app" id="inicio">
      <header className="topbar">
        <a className="brand" href="#inicio">
          <div className="brand-icon">
            <Waves size={27} />
          </div>

          <div>
            <h1>TIGRE ALERTA</h1>
            <p>Información para decidir mejor antes de salir</p>
          </div>
        </a>

        <div className="demo-badge">
          <span className="status-dot" />
          PROTOTIPO EN DESARROLLO
        </div>
      </header>

      <section className="welcome">
        <div>
          <span className="eyebrow">INFORMACIÓN TERRITORIAL</span>
          <h2>Antes de salir, conocé el camino.</h2>
          <p>
            Consultá el tiempo, explorá las zonas con antecedentes de
            anegamiento y prepará tus desplazamientos por Tigre.
          </p>
        </div>

        <div className="welcome-icon">
          <Navigation size={34} />
        </div>
      </section>

      <section className="notice">
        <ShieldAlert size={22} />

        <div>
          <strong>Información para prevención</strong>
          <p>
            El tiempo se consulta mediante un servicio meteorológico externo.
            El nivel del río y el estado actual de las calles todavía no
            están conectados. Los antecedentes históricos no indican si una
            calle está inundada hoy. Verificá las condiciones antes de salir.
          </p>
        </div>
      </section>

      <section className="metrics">
        <article className="metric-card">
          <div className="metric-heading">
            <span className="metric-icon blue">
              <Waves size={22} />
            </span>

            <span className="metric-label">NIVEL DEL RÍO</span>
          </div>

          <div className="metric-value">Sin datos</div>

          <p className="metric-description">
            Fuente hidrológica pendiente de conexión.
          </p>

          <div className="metric-footer">
            <Clock3 size={15} />
            Medición no disponible
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-heading">
            <span className="metric-icon violet">
              <CloudRain size={22} />
            </span>

            <span className="metric-label">ESTADO METEOROLÓGICO</span>
          </div>

          <div className="metric-value">
            {cargandoClima
              ? "Consultando..."
              : temperatura !== undefined
                ? `${Math.round(temperatura)} °C`
                : "Sin datos"}
          </div>

          <p className="metric-description">
            {codigoClima !== undefined
              ? describirClima(codigoClima)
              : errorClima || "Consultá el estado meteorológico."}
          </p>

          <div className="metric-footer">
            <Activity size={15} />
            {ultimaActualizacion
              ? `Actualizado: ${ultimaActualizacion.toLocaleTimeString(
                  "es-AR",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}`
              : "Actualización pendiente"}
          </div>

          {clima && (
            <div className="weather-details">
              <span>
                <Thermometer size={15} />
                Sensación: {Math.round(sensacion)} °C
              </span>

              <span>
                <CloudRain size={15} />
                Precipitación: {lluvia} mm
              </span>

              <span>
                <Wind size={15} />
                Viento: {viento} km/h
              </span>
            </div>
          )}

          <button
            className="text-action"
            type="button"
            onClick={consultarClima}
            disabled={cargandoClima}
          >
            <RefreshCw
              size={15}
              className={cargandoClima ? "spinning" : ""}
            />
            {cargandoClima ? "Actualizando..." : "Actualizar tiempo"}
          </button>

          {errorClima && (
            <p className="inline-error">{errorClima}</p>
          )}

          <p className="source-note">
            Fuente: Open-Meteo. Datos meteorológicos para la zona de Tigre.
          </p>
        </article>

        <article className="metric-card">
          <div className="metric-heading">
            <span className="metric-icon orange">
              <AlertTriangle size={22} />
            </span>

            <span className="metric-label">CALLES AFECTADAS</span>
          </div>

          <div className="metric-value">Sin datos actuales</div>

          <p className="metric-description">
            Hay puntos de referencia y antecedentes históricos en el mapa.
          </p>

          <div className="metric-footer">
            <MapPin size={15} />
            Incidencias en tiempo real no conectadas
          </div>
        </article>
      </section>

      <section className="workspace">
        <article className="map-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">MAPA TERRITORIAL</span>
              <h3>Calles e incidencias</h3>
            </div>

            <span className="map-tag">
              <MapPin size={15} />
              Tigre, Buenos Aires
            </span>
          </div>

          <div className="map-filters">
            <div className="filter-heading">
              <Filter size={17} />
              <strong>Capas del mapa</strong>
            </div>

            <label className="filter-option">
              <input
                type="checkbox"
                checked={mostrarZonas}
                onChange={(event) => setMostrarZonas(event.target.checked)}
              />
              Zonas de referencia ({zonasInundables.length})
            </label>

            <label className="filter-option">
              <input
                type="checkbox"
                checked={mostrarAntecedentes}
                onChange={(event) =>
                  setMostrarAntecedentes(event.target.checked)
                }
              />
              Antecedentes de calles ({puntosAnegamiento.length})
            </label>
          </div>

          <div className="map-placeholder">
            <MapContainer
              center={[-34.405, -58.625]}
              zoom={12}
              scrollWheelZoom={true}
              style={{ width: "100%", height: "430px" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {mostrarZonas &&
                zonasInundables.map((zona) => (
                  <Marker
key={zona.id}
position={zona.coordenadas}
icon={iconoZona}

>

                    <Popup>
                      <strong>{zona.nombre}</strong>
                      <br />
                      Localidad: {zona.localidad}
                      <br />
                      Estado actual: sin datos actualizados.
                      <br />
                      {zona.descripcion}
                      <br />
                      <br />
                      <strong>Antecedente documentado</strong>
                      <br />
                      Fecha: {zona.fechaAntecedente || "Sin fecha registrada"}
                      <br />
                      Fuente: {zona.fuente || "Pendiente de verificar"}
                      <br />
                      {zona.urlFuente && (
                        <>
                          <a
                            href={zona.urlFuente}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Consultar fuente
                          </a>
                        </>
                      )}
                    </Popup>
                  </Marker>
                ))}

              {mostrarAntecedentes &&
                puntosAnegamiento.map((punto) => (
                  <Marker
key={punto.id}
position={punto.coordenadas}
icon={iconoAnegamiento}

>

                    <Popup>
                      <strong>{punto.nombre}</strong>
                      <br />
                      Localidad: {punto.localidad}
                      <br />
                      Antecedente: {punto.fechaAntecedente}
                      <br />
                      Estado actual: sin datos actualizados.
                      <br />
                      Fuente: {punto.fuente}
                      <br />
                      <a
                        href={punto.urlFuente}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Consultar fuente
                      </a>
                    </Popup>
                  </Marker>
                ))}

              {reportes
                .filter(
                  (reporte) =>
                    reporte.latitud !== null &&
                    reporte.latitud !== undefined &&
                    reporte.longitud !== null &&
                    reporte.longitud !== undefined &&
                    Number.isFinite(Number(reporte.latitud)) &&
                    Number.isFinite(Number(reporte.longitud))
                )
                .map((reporte) => (
                  <Marker
                    key={`reporte-${reporte.id}`}
                    position={[Number(reporte.latitud), Number(reporte.longitud)]}
                  >
                    <Popup>
                      <strong>Reporte ciudadano pendiente</strong>
                      <br />
                      {reporte.calle} — {reporte.localidad}
                      <br />
                      Tipo: {reporte.tipo_incidencia.replaceAll("_", " ")}
                      <br />
                      Nivel de agua: {reporte.nivel_agua.replaceAll("_", " ")}
                      <br />
                      Fecha: {formatearFechaReporte(reporte.creado_en)}
                      <br />
                      Estado: pendiente de verificación
                      {reporte.descripcion && (
                        <>
                          <br />
                          Descripción: {reporte.descripcion}
                        </>
                      )}
                    </Popup>
                  </Marker>
                ))}

              <AjustarMapa />
            </MapContainer>
          </div>

          <div className="map-legend">
            <span>
  <i className="legend-dot blue" />
  Zonas de referencia
</span>
            <span>
              <i className="legend-dot red" />
              Antecedente histórico
            </span>

            <span>
              <i className="legend-dot gray" />
              Estado actual desconocido
            </span>
          </div>

          <p className="source-note">
            Cartografía: OpenStreetMap. Los marcadores representan los datos
            cargados en el prototipo y no constituyen un mapa oficial de
            riesgo ni un registro completo de inundaciones.
          </p>
        </article>

        <aside className="route-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">PLANIFICADOR</span>
              <h3>Prepará tu recorrido</h3>
            </div>

            <div className="route-icon">
              <Route size={22} />
            </div>
          </div>

          <p className="route-intro">
            Indicá desde dónde salís y hacia dónde necesitás ir.
          </p>

          <form onSubmit={buscarRuta}>
            <label htmlFor="origen">PUNTO DE PARTIDA</label>

            <div className="input-wrap">
              <span className="input-dot origin-dot" />

              <input
                id="origen"
                type="text"
                placeholder="Ej. Estación de Tigre"
                value={origen}
                onChange={(event) => {
                  setOrigen(event.target.value);
                  setConsultaRealizada(false);
                  setErrorRuta("");
                }}
              />
            </div>

            <div className="route-connector" />

            <label htmlFor="destino">DESTINO</label>

            <div className="input-wrap">
              <MapPin size={18} />

              <input
                id="destino"
                type="text"
                placeholder="Ej. Hospital o dirección"
                value={destino}
                onChange={(event) => {
                  setDestino(event.target.value);
                  setConsultaRealizada(false);
                  setErrorRuta("");
                }}
              />
            </div>

            {errorRuta && (
              <p className="inline-error" role="alert">
                {errorRuta}
              </p>
            )}

            <button className="search-button" type="submit">
              <Search size={18} />
              Consultar recorrido
              <ExternalLink size={15} />
            </button>
          </form>

          {consultaRealizada && (
            <div className="route-feedback">
              <Navigation size={20} />

              <div>
                <strong>Consulta iniciada</strong>
                <p>
                  Se abrió Google Maps para calcular el recorrido. Este
                  prototipo todavía no verifica calles inundadas ni
                  garantiza que la ruta sea segura.
                </p>
              </div>
            </div>
          )}

          <div className="route-info">
            <ShieldAlert size={19} />

            <p>
              Antes de salir, verificá las alertas meteorológicas y las
              condiciones locales. Una ruta disponible en el mapa no
              garantiza que una calle esté transitable.
            </p>
          </div>

          <a
            className="external-map-link"
            href="https://www.google.com/maps/search/?api=1&query=Tigre%2C%20Buenos%20Aires"
            target="_blank"
            rel="noreferrer"
          >
            <Eye size={17} />
            Explorar Tigre en Google Maps
            <ExternalLink size={15} />
          </a>
        </aside>
      </section>

      <section className="reports-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">PARTICIPACIÓN CIUDADANA</span>
            <h3>Reportar una calle anegada</h3>
          </div>
          <div className="route-icon">
            <ClipboardList size={22} />
          </div>
        </div>

        <p className="route-intro">
          Si observás agua acumulada o una calle anegada en Tigre, podés informar
          el lugar. Los reportes se guardan como pendientes hasta que puedan verificarse.
        </p>

        <form className="report-form" onSubmit={enviarReporte}>
          <label htmlFor="reporte-calle">CALLE O INTERSECCIÓN *</label>
          <input
            id="reporte-calle"
            name="calle"
            type="text"
            placeholder="Ej. Santa María de las Conchas y Nemesio Pérez"
            value={formReporte.calle}
            onChange={cambiarCampoReporte}
            maxLength={200}
            required
          />

          <label htmlFor="reporte-localidad">LOCALIDAD *</label>
          <select
            id="reporte-localidad"
            name="localidad"
            value={formReporte.localidad}
            onChange={cambiarCampoReporte}
            required
          >
            {[
              "Tigre centro",
              "Rincón de Milberg",
              "Las Tunas",
              "Ricardo Rojas",
              "El Talar",
              "Troncos del Talar",
              "Benavídez",
              "Don Torcuato",
              "Otra zona de Tigre",
            ].map((localidad) => (
              <option key={localidad} value={localidad}>{localidad}</option>
            ))}
          </select>

          <div className="report-form-row">
            <div>
              <label htmlFor="reporte-tipo">TIPO DE INCIDENCIA</label>
              <select
                id="reporte-tipo"
                name="tipo_incidencia"
                value={formReporte.tipo_incidencia}
                onChange={cambiarCampoReporte}
              >
                <option value="calle_anegada">Calle anegada</option>
                <option value="agua_acumulada">Agua acumulada</option>
                <option value="arbol_caido">Árbol caído</option>
                <option value="otro">Otro problema</option>
              </select>
            </div>
            <div>
              <label htmlFor="reporte-nivel">NIVEL DEL AGUA</label>
              <select
                id="reporte-nivel"
                name="nivel_agua"
                value={formReporte.nivel_agua}
                onChange={cambiarCampoReporte}
              >
                <option value="bajo">Bajo</option>
                <option value="moderado">Moderado</option>
                <option value="alto">Alto</option>
                <option value="no_sabe">No lo sé</option>
              </select>
            </div>
          </div>

          <label htmlFor="reporte-descripcion">DESCRIPCIÓN (OPCIONAL)</label>
          <textarea
            id="reporte-descripcion"
            name="descripcion"
            placeholder="Contá qué observaste. No incluyas datos personales."
            value={formReporte.descripcion}
            onChange={cambiarCampoReporte}
            rows={3}
            maxLength={1000}
          />

          <details className="report-coordinates">
            <summary>Agregar coordenadas exactas (opcional)</summary>
            <p>Solo completalas si conocés las coordenadas del lugar. Sin coordenadas, el reporte aparecerá en la lista, pero no como marcador en el mapa.</p>
            <div className="report-form-row">
              <div>
                <label htmlFor="reporte-latitud">LATITUD</label>
                <input
                  id="reporte-latitud"
                  name="latitud"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  placeholder="-34.42"
                  value={formReporte.latitud}
                  onChange={cambiarCampoReporte}
                />
              </div>
              <div>
                <label htmlFor="reporte-longitud">LONGITUD</label>
                <input
                  id="reporte-longitud"
                  name="longitud"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  placeholder="-58.59"
                  value={formReporte.longitud}
                  onChange={cambiarCampoReporte}
                />
              </div>
            </div>
          </details>

          {errorReporte && <p className="inline-error" role="alert">{errorReporte}</p>}
          {mensajeReporte && (
            <p className="report-success" role="status">
              <CheckCircle2 size={18} />
              {mensajeReporte}
            </p>
          )}

          <button className="search-button" type="submit" disabled={enviandoReporte}>
            <Send size={17} />
            {enviandoReporte ? "Enviando reporte..." : "Enviar reporte"}
          </button>
        </form>

        <div className="reports-list">
          <div className="reports-list-heading">
            <h4>Reportes recibidos</h4>
            <button className="text-action" type="button" onClick={cargarReportes} disabled={cargandoReportes}>
              <RefreshCw size={15} />
              Actualizar
            </button>
          </div>
          <p className="source-note">
            Los reportes ciudadanos no son confirmaciones oficiales. Verificá siempre las condiciones locales.
          </p>

          {cargandoReportes ? (
            <p>Cargando reportes...</p>
          ) : reportes.length === 0 ? (
            <p>Todavía no hay reportes registrados.</p>
          ) : (
            <div className="reports-list-items">
              {reportes.map((reporte) => (
                <article className="report-item" key={reporte.id}>
                  <div className="report-item-heading">
                    <strong>{reporte.calle}</strong>
                    <span className="report-status">{reporte.estado || "pendiente"}</span>
                  </div>
                  <p>{reporte.localidad} · {reporte.tipo_incidencia.replaceAll("_", " ")}</p>
                  <p>Nivel de agua: {reporte.nivel_agua.replaceAll("_", " ")}</p>
                  {reporte.descripcion && <p>{reporte.descripcion}</p>}
                  <small>{formatearFechaReporte(reporte.creado_en)}</small>
                  {reporte.latitud != null && reporte.longitud != null && (
                    <small className="report-coord-note"> · Ubicación señalada en el mapa</small>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="sources-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">FUENTES DE CONSULTA</span>
            <h3>Información para verificar</h3>
          </div>
        </div>

        <div className="sources-grid">
          <a
            href="https://www.smn.gob.ar/"
            target="_blank"
            rel="noreferrer"
          >
            <CloudRain size={21} />
            <span>
              <strong>Servicio Meteorológico Nacional</strong>
              <small>Alertas meteorológicas oficiales</small>
            </span>
            <ExternalLink size={16} />
          </a>

          <a
            href="https://alerta.ina.gov.ar/"
            target="_blank"
            rel="noreferrer"
          >
            <Waves size={21} />
            <span>
              <strong>Instituto Nacional del Agua</strong>
              <small>Información hidrológica</small>
            </span>
            <ExternalLink size={16} />
          </a>

          <a
            href="https://www.tigre.gob.ar/seguridad/defensa_civil"
            target="_blank"
            rel="noreferrer"
          >
            <ShieldAlert size={21} />
            <span>
              <strong>Defensa Civil de Tigre</strong>
              <small>Información municipal y prevención</small>
            </span>
            <ExternalLink size={16} />
          </a>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-brand">
          <Waves size={18} />
          <strong>TIGRE ALERTA</strong>
        </div>

        <p>
          Prototipo académico en desarrollo · Información territorial para
          la comunidad
        </p>

        <a href="#inicio">Volver al inicio ↑</a>
      </footer>
    </main>
  );
}

export default App;