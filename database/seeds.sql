-- Insertar administrador (contraseña: admin123)
INSERT INTO cliente (nombre, correo_usuario, contrasena, es_admin, valida_inf)
VALUES ('Administrador', 'admin@ticketflow.com', '$2a$10$rVvzHjKsKjQqVvVvVvVvVuf4f5f6f7f8f9f0f1f2f3f4f5f6f7f8f', true, true)
ON CONFLICT (correo_usuario) DO NOTHING;

-- Insertar eventos demo
INSERT INTO evento (nombre_evento, fecha_evento, hora_evento, ubicacion, capacidad_total, boletos_disponibles, precio_normal, precio_preventa, es_preventa) VALUES
('Coldplay - Music of the Spheres', '2025-06-15', '20:00:00', 'Estadio Azteca, CDMX', 5000, 5000, 1890, 1490, true),
('Bizarrap Live Session', '2025-07-22', '21:00:00', 'Movistar Arena, BA', 3000, 3000, 750, 599, true),
('Lollapalooza Argentina', '2025-03-21', '12:00:00', 'Hipódromo de San Isidro', 80000, 80000, 12500, 9900, false),
('The Weeknd: After Hours', '2025-10-05', '21:00:00', 'Foro Sol, CDMX', 65000, 65000, 2450, 1990, true),
('Final Liga MX', '2025-05-18', '19:00:00', 'Estadio Azteca', 87000, 87000, 890, 890, false);