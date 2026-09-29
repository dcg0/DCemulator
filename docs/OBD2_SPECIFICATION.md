# Especificación técnica de aplicación OBD-II

## 1. Alcance y compatibilidad

La aplicación soportará **OBD-II genérico** cuando el vehículo exponga los servicios y PIDs correspondientes. Las funciones específicas del fabricante, módulos no relacionados con emisiones y protocolos propietarios quedan fuera de alcance salvo que se implementen expresamente.

Las funciones OBD-II genéricas no garantizan acceso a todos los módulos del vehículo ni a todos los códigos de diagnóstico.

---

## 2. Requisitos de compatibilidad y condiciones de operación

### Adaptador

- Adaptador compatible con los comandos ELM327 necesarios para la aplicación.
- Evitar adaptadores que anuncien versiones falsas, firmware modificado o compatibilidad limitada con CAN.
- Soporte de transporte según plataforma:
  - Bluetooth clásico para Android, cuando el adaptador lo requiera.
  - Bluetooth Low Energy (BLE) para Android e iOS.
  - Wi-Fi cuando el adaptador y la plataforma lo permitan.
- Soporte de respuestas multilínea, respuestas fragmentadas y comandos largos.
- El PIN `0000` o `1234` puede sugerirse durante el emparejamiento, pero no debe asumirse como universal.
- No se recomienda dejar el adaptador conectado permanentemente, especialmente en vehículos con consumo en reposo o sistemas sensibles.

### Vehículo

- Ignición en posición ON; el motor puede estar apagado o encendido según la prueba.
- Alimentación estable en el pin 16 del puerto OBD.
- Tierra correcta en los pines 4 y/o 5.
- El voltaje puede ser inferior a 12 V con el motor apagado; la aplicación debe registrar o mostrar la condición de alimentación cuando sea posible.
- El puerto, el vehículo y el adaptador deben ser físicamente compatibles.

---

## 3. Permisos y capacidades móviles

### Android 12 y posteriores

Solicitar en tiempo de ejecución, según las funciones usadas:

- `BLUETOOTH_SCAN`
- `BLUETOOTH_CONNECT`
- `BLUETOOTH_ADVERTISE` únicamente si la aplicación anuncia servicios propios.

La ubicación no debe solicitarse como requisito general para Android 12+. Debe solicitarse solo si la versión de Android, la API o la implementación concreta del escaneo Bluetooth lo exige.

La aplicación debe distinguir y explicar los estados de permiso concedido, denegado y bloqueado permanentemente.

### Android 11 e inferiores

- `BLUETOOTH`
- `BLUETOOTH_ADMIN`
- `ACCESS_FINE_LOCATION` para escaneo Bluetooth cuando corresponda a la versión y API utilizadas.

Solicitar estos permisos en tiempo de ejecución; no basta con declararlos en el manifiesto.

### iOS

- Usar BLE mediante Core Bluetooth. iOS no admite Bluetooth clásico genérico mediante Core Bluetooth.
- Incluir `NSBluetoothAlwaysUsageDescription` con una explicación clara del uso del Bluetooth.
- Manejar los estados autorizado, denegado, restringido y no disponible.
- Declarar `UIBackgroundModes: bluetooth-central` únicamente si se necesita operar con Bluetooth en segundo plano; no es un permiso obligatorio para el uso normal.
- El acceso a adaptadores Wi-Fi debe implementarse y documentarse como transporte independiente de BLE.

---

## 4. Gestión de conexión

### Con el adaptador

- Detectar y enumerar adaptadores compatibles según el transporte disponible.
- Permitir selección manual del adaptador.
- Mostrar nombre, dirección, transporte y estado de conexión sin exponer datos innecesarios.
- Manejar desconexiones inesperadas.
- Implementar reconexión automática con límite de intentos y backoff progresivo.
- Permitir cancelación por parte del usuario.
- No bloquear la interfaz durante la conexión, inicialización o lectura de datos.

### Secuencia de inicialización

Usar una secuencia configurable y tolerante a variantes del firmware:

```text
ATZ       Reiniciar el adaptador
ATE0      Desactivar eco
ATL0      Desactivar saltos de línea
ATS0      Suprimir espacios, si el parser lo contempla
ATH0      Ocultar cabeceras, opcional
ATSP0     Selección automática de protocolo
ATAT1     Ajuste adaptativo de temporización, si está soportado
```

No todos los adaptadores soportan todos los comandos. Las respuestas `?`, `ERROR` o equivalentes deben registrarse sin bloquear el flujo.

Para cada comando:

- Esperar el prompt `>` antes de enviar el siguiente comando.
- Soportar el prompt fragmentado o recibido en un paquete separado.
- Definir timeout por comando, timeout de conexión y número máximo de reintentos.
- Usar una pausa inicial aproximada de 100–150 ms solo como medida de compatibilidad para adaptadores lentos; no tratarla como regla universal.
- Ajustar el timeout para operaciones lentas como inicialización de protocolo, lectura de VIN y respuestas multilínea.
- Cancelar la operación inmediatamente si se detecta desconexión o pérdida de ignición.

### Con el vehículo

- Intentar primero la selección automática mediante `ATSP0`.
- Si la detección falla, permitir selección manual de protocolo y mostrar una advertencia de compatibilidad.
- No asumir que todos los vehículos aceptan todos los protocolos.

| Comando | Protocolo |
|---|---|
| `ATSP3` | ISO 9141-2 |
| `ATSP4` | ISO 14230-4 KWP, inicialización de 5 baudios |
| `ATSP5` | ISO 14230-4 KWP, inicialización rápida |
| `ATSP6` | ISO 15765-4 CAN, 11 bits, 500 kbit/s |
| `ATSP7` | ISO 15765-4 CAN, 29 bits, 500 kbit/s |
| `ATSP8` | ISO 15765-4 CAN, 11 bits, 250 kbit/s |
| `ATSP9` | ISO 15765-4 CAN, 29 bits, 250 kbit/s |

---

## 5. Comandos y procesamiento de datos

### Comandos esenciales

- `03`: leer códigos almacenados o confirmados.
- `07`: leer códigos pendientes.
- `0A`: leer códigos permanentes cuando el vehículo los soporte.
- `04`: borrar códigos y datos asociados.
- `0100`, `0120`, `0140`, etc.: consultar PIDs soportados.
- `0101`: consultar estado de la MIL y monitores de emisiones.
- `010C`: RPM.
- `010D`: velocidad.
- `0105`: temperatura del refrigerante del motor.
- `0902`: VIN, cuando el vehículo lo soporte; puede devolver varias respuestas.

Antes de consultar un PID, validar que esté soportado mediante la respuesta correspondiente a la consulta de PIDs.

### Borrado de códigos

Antes de ejecutar `04`:

- Mostrar una advertencia clara.
- Informar que pueden reiniciarse los monitores de emisiones.
- Solicitar una confirmación explícita.
- Impedir la operación si el vehículo está en movimiento.

El resultado debe expresarse así:

> “El vehículo aceptó o rechazó la solicitud de borrado. La luz de advertencia puede permanecer encendida o reaparecer si la causa persiste.”

No prometer que el borrado apagará siempre la luz Check Engine.

### Normalización y parser

- Eliminar espacios, saltos de línea `\r` y `\n`, y caracteres de transporte conocidos sin destruir la respuesta original.
- Conservar siempre la respuesta cruda para depuración.
- Filtrar o clasificar respuestas como `?`, `ERROR`, `NO DATA`, `BUS INIT...`, `UNABLE TO CONNECT` y `SEARCHING...`.
- Soportar respuestas fragmentadas, multilínea y múltiples marcos CAN.
- Validar longitud, prefijos y checksum cuando el protocolo lo requiera.
- Diferenciar dato no soportado, dato no disponible temporalmente, respuesta inválida, timeout y valor válido igual a cero.
- Convertir hexadecimal a decimal según las fórmulas de SAE J1979.
- Mantener internamente unidades SI y convertirlas únicamente en la interfaz.

### Fórmulas mínimas de ejemplo

- RPM: `((A * 256) + B) / 4`
- Velocidad: `A` km/h
- Temperatura del refrigerante: `A - 40` °C

Documentar la fórmula de cada PID implementado.

### DTC y códigos del fabricante

- Decodificar correctamente DTC de dos y tres bytes.
- Distinguir códigos almacenados, pendientes y permanentes.
- Marcar los códigos específicos del fabricante cuando no exista una explicación genérica confiable.
- Diferenciar OBD-II genérico de diagnósticos propietarios o UDS.
- No presentar una explicación como definitiva si depende del fabricante o del modelo.

---

## 6. Modelo de resultado de comandos

Usar una estructura equivalente a:

```text
CommandResult
- command
- transport
- protocol
- rawResponse
- normalizedResponse
- status: success | unsupported | timeout | disconnected | malformed | vehicle_error
- parsedValue
- errorCode
- timestamp
```

Esto facilitará el registro, la depuración, la reconexión y la presentación de mensajes claros al usuario.

---

## 7. Manejo de errores y estados

Mostrar mensajes claros, accionables y no técnicos cuando sea posible:

- “No se encontró un adaptador compatible.”
- “Concede el permiso Bluetooth necesario para continuar.”
- “Verifica que la ignición esté encendida.”
- “Sin respuesta del vehículo; revisa el protocolo y la conexión.”
- “El adaptador se desconectó. Intentando reconectar.”
- “El vehículo no proporciona este PID.”
- “La operación tardó demasiado y fue cancelada.”

Requisitos:

- Registrar fallos para depuración sin incluir secretos.
- Evitar bloqueos cuando se desconecta el adaptador o se apaga la ignición.
- Permitir reintento manual.
- Mostrar un estado de conexión visible: desconectado, conectando, inicializando, conectado, reconectando o error.
- Limitar la frecuencia de reconexión y detenerla al salir de la pantalla o cerrar la sesión.

---

## 8. Seguridad y privacidad

- No ejecutar comandos de escritura, actuadores, codificación o programación como parte de una aplicación OBD-II genérica.
- No borrar DTC automáticamente.
- No borrar DTC mientras el vehículo está en movimiento.
- Informar que los datos son orientativos y no sustituyen un diagnóstico profesional.
- Proteger los informes almacenados localmente.
- Informar al usuario antes de guardar o compartir el VIN.
- No incluir contraseñas, tokens ni credenciales en registros o informes.
- Minimizar la exposición de direcciones IP, identificadores Bluetooth y demás datos del adaptador.
- Solicitar solo los permisos necesarios para la función activa.

---

## 9. Funciones mínimas funcionales

- Leer y mostrar códigos almacenados, pendientes y permanentes cuando estén disponibles.
- Mostrar una explicación sencilla, indicando si es genérica o específica del fabricante.
- Solicitar el borrado de códigos con advertencia y confirmación.
- Visualizar datos en tiempo real con números y gráficos.
- Mostrar PIDs soportados y distinguir datos no disponibles.
- Leer el VIN cuando el vehículo lo soporte.
- Consultar estado de MIL y monitores de emisiones.
- Guardar y compartir informes de escaneo.
- Seleccionar unidades de medida: °C/°F, km/millas, kPa/PSI.
- Pausar o detener el streaming de datos.
- Mostrar el estado de conexión y el protocolo negociado.

---

## 10. Pruebas obligatorias antes de lanzar

### Compatibilidad

1. Probar primero con una aplicación conocida, como Car Scanner o AndrOBD, para confirmar que el adaptador y el vehículo responden.
2. Verificar la aplicación en al menos dos marcas y modelos distintos.
3. Probar al menos un vehículo CAN y, si se declara compatibilidad, uno ISO/KWP.
4. Probar adaptadores BLE, Bluetooth clásico y Wi-Fi únicamente en las plataformas donde estén soportados.
5. Probar un adaptador estable y otro lento o con respuestas fragmentadas.
6. Probar Android 11, Android 12 o posterior y una versión reciente de iOS si ambas plataformas forman parte del alcance.

### Fallos y recuperación

7. Comprobar comportamiento al salir de rango y volver.
8. Desconectar durante la conexión inicial.
9. Desconectar durante lectura de DTC, streaming de PIDs, lectura de VIN y borrado de códigos.
10. Apagar la ignición durante una operación.
11. Probar batería baja o alimentación inestable.
12. Probar respuestas `NO DATA`, `SEARCHING...`, `UNABLE TO CONNECT`, `ERROR`, `?`, timeout y datos malformados.
13. Verificar respuestas multilínea, fragmentadas y con múltiples marcos CAN.
14. Confirmar que el parser no confunde un valor válido con un error.
15. Verificar que la reconexión no provoque bucles ni bloquee la interfaz.

### Seguridad, privacidad y experiencia

16. Confirmar que la aplicación no borra DTC sin confirmación.
17. Confirmar que no permite borrar DTC mientras el vehículo está en movimiento.
18. Comprobar permisos concedidos, denegados y bloqueados permanentemente.
19. Verificar cierre y reapertura de la aplicación.
20. Revisar consumo de batería durante streaming.
21. Verificar que los informes no exponen secretos ni datos innecesarios.
22. Validar que las unidades y fórmulas coinciden con una herramienta de referencia.
23. Ejecutar una prueba completa de usuario desde la conexión hasta la exportación del informe.
