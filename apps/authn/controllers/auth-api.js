exports.logout = (req, res) => {
    if (req.session) {
        req.session.destroy( (err) => {
            if (err) {
                console.log(err);
                return res.status(500).send({errors: err});
            }
            res.status(200).send({status: 'success'});
        });
    } else {
        return res.status(200).send({status: 'success'});
    }
}