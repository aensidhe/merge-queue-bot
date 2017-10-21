local function create_users_space()
    local sequence =  box.schema.sequence.create('UserIdGenerator')
    local space = box.schema.space.create("users", {
        if_not_exists = true,
        format = {
            { name="id", type="unsigned" },
            { name="name", type="string" }
        }
    })

    space:create_index('primary', {
        type= "TREE",
        unique = true,
        if_not_exists = true,
        parts = {
            { 1, "unsigned" }
        },
        sequence = sequence.name
    })
end

create_users_space()