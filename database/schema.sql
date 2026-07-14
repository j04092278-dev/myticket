-- ============================================================
-- MyTicket - Esquema completo de base de datos (sin verificación)
-- ============================================================

DROP TABLE IF EXISTS transacciones CASCADE;
DROP TABLE IF EXISTS venta CASCADE;
DROP TABLE IF EXISTS boletos CASCADE;
DROP TABLE IF EXISTS evento CASCADE;
DROP TABLE IF EXISTS ine_validacion CASCADE;
DROP TABLE IF EXISTS auditoria CASCADE;
DROP TABLE IF EXISTS logs_seguridad CASCADE;
DROP TABLE IF EXISTS cliente CASCADE;

-- ========== CLIENTES (USUARIOS) ==========
CREATE TABLE cliente (
    id_cliente SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    edad INTEGER,
    telefono VARCHAR(20),
    correo_usuario VARCHAR(100) UNIQUE NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    es_admin BOOLEAN DEFAULT FALSE,
    factor_tarjeta VARCHAR(20),
    num_tarjeta TEXT,
    cv TEXT,
    fecha_inf DATE,
    valida_inf BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== EVENTOS ==========
CREATE TABLE evento (
    id_evento SERIAL PRIMARY KEY,
    nombre_evento VARCHAR(200) NOT NULL,
    fecha_evento DATE NOT NULL,
    hora_evento TIME NOT NULL,
    ubicacion VARCHAR(200) NOT NULL,
    capacidad_total INTEGER NOT NULL,
    boletos_disponibles INTEGER NOT NULL,
    precio_normal DECIMAL(10,2) NOT NULL,
    precio_preventa DECIMAL(10,2),
    es_preventa BOOLEAN DEFAULT FALSE,
    imagen_url VARCHAR(500),
    preventa_inicio TIMESTAMP,
    preventa_fin TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== BOLETOS ==========
CREATE TABLE boletos (
    id_boleto SERIAL PRIMARY KEY,
    id_evento INTEGER REFERENCES evento(id_evento) ON DELETE CASCADE,
    id_cliente INTEGER REFERENCES cliente(id_cliente) ON DELETE CASCADE,
    zona VARCHAR(50),
    asiento VARCHAR(20),
    codigo_unico VARCHAR(50) UNIQUE NOT NULL,
    qr_codigo TEXT,
    estatus VARCHAR(20) DEFAULT 'activo',
    tipo_precio VARCHAR(20) DEFAULT 'normal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== VENTAS ==========
CREATE TABLE venta (
    id_venta SERIAL PRIMARY KEY,
    id_cliente INTEGER REFERENCES cliente(id_cliente),
    id_evento INTEGER REFERENCES evento(id_evento),
    id_boleto INTEGER REFERENCES boletos(id_boleto),
    fecha_venta DATE NOT NULL,
    hora_venta TIME NOT NULL,
    precio_pagado DECIMAL(10,2) NOT NULL,
    referencia_boleto VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== TRANSACCIONES ==========
CREATE TABLE transacciones (
    id_transaccion SERIAL PRIMARY KEY,
    id_cliente INTEGER REFERENCES cliente(id_cliente),
    id_boleto INTEGER REFERENCES boletos(id_boleto),
    fecha_transaccion DATE NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    estado VARCHAR(20) DEFAULT 'completado',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== VALIDACIÓN INE ==========
CREATE TABLE ine_validacion (
    id_ine SERIAL PRIMARY KEY,
    id_cliente INTEGER REFERENCES cliente(id_cliente) UNIQUE,
    numero_ine VARCHAR(20) UNIQUE NOT NULL,
    curp VARCHAR(18) NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    sexo CHAR(1) CHECK (sexo IN ('M', 'F')),
    entidad_emision VARCHAR(50),
    documento_imagen TEXT,
    selfie_imagen TEXT,
    validado BOOLEAN DEFAULT FALSE,
    facial_verificado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== AUDITORÍA ==========
CREATE TABLE auditoria (
    id_auditoria SERIAL PRIMARY KEY,
    tabla_afectada VARCHAR(50),
    accion VARCHAR(20),
    id_registro INTEGER,
    usuario_id INTEGER REFERENCES cliente(id_cliente),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    datos_anteriores JSONB,
    datos_nuevos JSONB
);

-- ========== LOGS DE SEGURIDAD ==========
CREATE TABLE logs_seguridad (
    id_log SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES cliente(id_cliente),
    ip VARCHAR(45),
    user_agent TEXT,
    evento VARCHAR(100),
    descripcion TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ÍNDICES
CREATE INDEX idx_boletos_evento ON boletos(id_evento);
CREATE INDEX idx_boletos_cliente ON boletos(id_cliente);
CREATE INDEX idx_venta_cliente ON venta(id_cliente);
CREATE INDEX idx_transacciones_cliente ON transacciones(id_cliente);
CREATE INDEX idx_ine_cliente ON ine_validacion(id_cliente);

-- USUARIO ADMIN (contraseña: admin123)
INSERT INTO cliente (nombre, correo_usuario, contrasena, es_admin, valida_inf)
VALUES ('Administrador', 'admin@myticket.com', '$2a$10$rVvzHjKsKjQqVvVvVvVvVuf4f5f6f7f8f9f0f1f2f3f4f5f6f7f8f', true, true)
ON CONFLICT (correo_usuario) DO NOTHING;