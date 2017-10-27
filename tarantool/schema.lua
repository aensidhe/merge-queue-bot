local function create_users_space()
    local sequence =  box.schema.sequence.create('user_id', { if_not_exists = true })
    local space = box.schema.space.create("users", {
        if_not_exists = true,
        format = {
            { name="id", type="unsigned" },
            { name="name", type="string" },
            { name="externalId", type="string" }
        }
    })

    space:create_index('primary', {
        type= "TREE",
        unique = true,
        if_not_exists = true,
        sequence = sequence.name,
        parts = { 1, "unsigned" }
    })

    space:create_index('external', {
        type= "HASH",
        unique = true,
        if_not_exists = true,
        parts = { 3, "string" }
    })
end

local function create_repositories_space()
    local sequence =  box.schema.sequence.create('repository_id', { if_not_exists = true })
    local space = box.schema.space.create("repository", {
        if_not_exists = true,
        format = {
            { name="id", type="unsigned" },
            { name="organization", type="string" },
            { name="name", type="string" },
            { name="token_id", type="unsigned" }
        }
    })

    space:create_index('primary', {
        type= "TREE",
        unique = true,
        if_not_exists = true,
        sequence = sequence.name,
        parts = { 1, "unsigned" }
    })

    space:create_index('organization_name', {
        type= "TREE",
        unique = true,
        if_not_exists = true,
        parts = { 2, "string", 3, "string" }
    })
end

local function create_pull_requests_space()
    local sequence =  box.schema.sequence.create('pull_request_id', { if_not_exists = true })
    local main_space = box.schema.space.create("pull_requests", {
        if_not_exists = true,
        format = {
            { name="id", type="unsigned" },
            { name="etag", type="string" },
            { name="reporter_id", type="unsigned" },
            { name="repository_id", type="unsigned" },
            { name="pull_request_id", type="unsigned" },
            { name="state", type="string" }
        }
    })

    main_space:create_index('primary', {
        type= "TREE",
        unique = true,
        if_not_exists = true,
        sequence = sequence.name,
        parts = { 1, "unsigned" }
    })

    local queue_space = box.schema.space.create("pull_requests_queue", {
        if_not_exists = true,
        format = {
            { name="pull_request_id", type="unsigned" },
            { name="added_utc", type="integer" }
        }
    })

    queue_space:create_index('primary', {
        type= "TREE",
        unique = true,
        if_not_exists = true,
        parts = { 1, "unsigned" }
    })

    queue_space:create_index('queue', {
        type= "TREE",
        if_not_exists = true,
        parts = { 2, "integer" }
    })

    local history_space = box.schema.space.create("pull_requests_history", {
        if_not_exists = true,
        format = {
            { name="id", type="unsigned" },
            { name="pull_request_id", type="unsigned" },
            { name="action_utc", type="integer" },
            { name="action", type="string" }
            -- { name="delta", type=""} tuple with changes
        }
    })

    history_space:create_index('primary', {
        type= "TREE",
        unique = true,
        if_not_exists = true,
        sequence = sequence.name,
        parts = { 1, "unsigned" }
    })
end

local function create_token_space()
    local sequence =  box.schema.sequence.create('sequence_id', { if_not_exists = true })
    local space = box.schema.space.create("github_tokens", {
        if_not_exists = true,
        format = {
            { name="id", type="unsigned" },
            { name="name", type="string" },
            { name="owner_id", type="unsigned" },
            { name="token", type="string" }
        }
    })

    space:create_index('primary', {
        type= "TREE",
        unique = true,
        if_not_exists = true,
        sequence = sequence.name,
        parts = { 1, "unsigned" }
    })

    space:create_index('user_id', {
        type= "TREE",
        if_not_exists = true,
        parts = { 3, "unsigned" }
    })

    space:create_index('user_id_name', {
        type= "HASH",
        unique = true,
        if_not_exists = true,
        parts = { 3, "unsigned", 2, "string" }
    })
end

create_users_space()
create_repositories_space()
create_pull_requests_space()
create_token_space()