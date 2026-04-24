<?php
// CORS Headers (Allows your local React app to test against the live DB)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, DELETE, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Handle Preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

// DATABASE CREDENTIALS
$host = 'din-database-server.com'; // F.eks. mysql22.unoeuro.com
$db   = 'dit_databasenavn';
$user = 'din_databasebruger';
$pass = 'DIT_HEMMELIGE_KODEORD';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    echo json_encode(["error" => "Connection failed."]); exit();
}

$method = $_SERVER['REQUEST_METHOD'];
$action_get = $_GET['action'] ?? ''; // PATCH 1: Definer variablen så GET requests ikke crasher

// --- GET REQUESTS ---
if ($method === 'GET') {
    if ($action_get === 'nodes') {
        $stmt = $pdo->query('SELECT id, USER as name FROM nodes ORDER BY USER ASC'); // PATCH 2: Sikrer at vi henter fra 'USER' kolonnen
        echo json_encode($stmt->fetchAll());
        exit();
    } elseif ($action_get === 'tags') {
        $stmt = $pdo->query('SELECT * FROM tags ORDER BY name ASC');
        echo json_encode($stmt->fetchAll());
        exit();
    } else {
        $stmt = $pdo->query('SELECT id, `user` AS user, work_date, start_time, end_time, hours, task FROM time_ledger ORDER BY work_date DESC, start_time DESC');
        echo json_encode($stmt->fetchAll());
        exit();
    }
}

// --- POST REQUESTS ---
if ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"));
    if(!$data) exit();
    
    // Add Tag Interceptor
    if (isset($data->action) && $data->action === 'add_tag') {
        $stmt = $pdo->prepare('INSERT INTO tags (name) VALUES (?)');
        $stmt->execute([$data->name]);
        echo json_encode(["status" => "success", "id" => $pdo->lastInsertId(), "name" => $data->name]);
        exit();
    }
    
    // Auth Interceptor
    if (isset($data->action) && $data->action === 'authenticate') {
        $admin_hash = '$2a$10$m6D25tmLglkROgM6HlX31.Uhufs/QVZA1zkB49tpaBDIZxOQ9BTx2'; 
        if (password_verify($data->password, $admin_hash)) {
            http_response_code(200); echo json_encode(["status" => "VERIFIED"]);
        } else {
            http_response_code(401); echo json_encode(["error" => "INVALID PAYLOAD"]);
        }
        exit();
    }

    // Tilføj Node (PATCH 3: Skriver nu til 'USER' kolonnen, ikke 'name')
    if (isset($data->action) && $data->action === 'add_node') {
        $stmt = $pdo->prepare('INSERT INTO nodes (USER) VALUES (?)');
        $stmt->execute([$data->name]);
        echo json_encode(["status" => "success", "id" => $pdo->lastInsertId(), "name" => $data->name]);
        exit();
    }

    // Sikker Redigering
    if (isset($data->action) && $data->action === 'edit_log') {
        $stmt = $pdo->prepare('UPDATE time_ledger SET work_date=?, start_time=?, end_time=?, hours=?, task=? WHERE id=?');
        $stmt->execute([$data->date, $data->start, $data->end, $data->hours, $data->task, $data->id]);
        echo json_encode(["status" => "updated"]);
        exit();
    }

    // Standard Time Ingestion 
    $stmt = $pdo->prepare('INSERT INTO time_ledger (`user`, work_date, start_time, end_time, hours, task) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->execute([$data->user, $data->date, $data->start, $data->end, $data->hours, $data->task]);
    echo json_encode(["id" => $pdo->lastInsertId()]);
    exit();
}

// --- PUT REQUESTS ---
if ($method === 'PUT') {
    $data = json_decode(file_get_contents("php://input"));
    if(!$data) exit();
    
    $stmt = $pdo->prepare('UPDATE time_ledger SET work_date=?, start_time=?, end_time=?, hours=?, task=? WHERE id=?');
    $stmt->execute([$data->date, $data->start, $data->end, $data->hours, $data->task, $data->id]);
    echo json_encode(["status" => "updated"]);
    exit();
}

// --- DELETE REQUESTS ---
if ($method === 'DELETE') {
    // PATCH 4: Definerer $data FØR vi bruger if-sætninger, der læser fra $data
    $data = json_decode(file_get_contents("php://input"));
    if(!$data) exit();

    // Node Tag Interceptor
    if (isset($data->action) && $data->action === 'delete_tag') {
        $stmt = $pdo->prepare('DELETE FROM tags WHERE id=?');
        $stmt->execute([$data->id]);
        echo json_encode(["status" => "deleted"]);
        exit();
    }

    // Slet Node (PATCH 5: Genindført)
    if (isset($data->action) && $data->action === 'delete_node') {
        $stmt = $pdo->prepare('DELETE FROM nodes WHERE id=?');
        $stmt->execute([$data->id]);
        echo json_encode(["status" => "deleted"]);
        exit();
    }
    
    // Standard Ledger Sletning
    $stmt = $pdo->prepare('DELETE FROM time_ledger WHERE id=?');
    $stmt->execute([$data->id]);
    echo json_encode(["status" => "deleted"]);
    exit();
}
?>